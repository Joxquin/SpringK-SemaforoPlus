// ESP32-CAM (AI-Thinker pinout) web camera for the RHYX M21-45 module.
//
// The M21-45 is a GalaxyCore GC2145 sensor. Unlike the OV2640 it has no
// hardware JPEG encoder, so the stock CameraWebServer example (which asks for
// PIXFORMAT_JPEG) fails with it. Here the sensor delivers RGB565 frames and
// the ESP32 encodes them to JPEG in software.
//
//   http://<ip>/            web UI
//   http://<ip>/capture     single JPEG snapshot
//   http://<ip>:81/stream   MJPEG stream
//   http://<ip>/status      JSON status
//   http://<ip>/control?var=<framesize|quality|hmirror|vflip|led>&val=<n>
//   tcp://<ip>:82           raw RGB565 stream, one client at a time (see raw_viewer.py)
//
// The raw port skips JPEG encoding entirely - it forwards the sensor's own
// RGB565 bytes straight over TCP, so it's not limited by the ESP32's software
// JPEG encoder. Each frame is prefixed with an 8-byte little-endian header
// [uint16 width][uint16 height][uint32 length]; RGB565 pixels are big-endian
// (high byte first), matching this library's JPEG encoder convention.

#include "esp_camera.h"
#include "esp_http_server.h"
#include "esp_timer.h"
#include <WiFi.h>
#include <WiFiUdp.h>
#include "wifi_config.h"
static WiFiUDP udp;
#include "index_html.h"

// AI-Thinker ESP32-CAM
#define PWDN_GPIO_NUM  32
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM  0
#define SIOD_GPIO_NUM  26
#define SIOC_GPIO_NUM  27
#define Y9_GPIO_NUM    35
#define Y8_GPIO_NUM    34
#define Y7_GPIO_NUM    39
#define Y6_GPIO_NUM    36
#define Y5_GPIO_NUM    21
#define Y4_GPIO_NUM    19
#define Y3_GPIO_NUM    18
#define Y2_GPIO_NUM    5
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM  23
#define PCLK_GPIO_NUM  22
#define FLASH_LED_PIN  4

// Resolutions offered in the UI. Each RGB565 frame buffer takes w*h*2 bytes
// of PSRAM, so the larger sizes run with a single frame buffer.
static const framesize_t kAllowedSizes[] = {
  FRAMESIZE_QQVGA, FRAMESIZE_QVGA, FRAMESIZE_CIF, FRAMESIZE_HVGA,
  FRAMESIZE_VGA, FRAMESIZE_SVGA, FRAMESIZE_XGA, FRAMESIZE_HD,
};

// Latest encoded frame, shared between the capture task and HTTP handlers.
static SemaphoreHandle_t frameLock;
static uint8_t *latestJpg = nullptr;
static size_t latestLen = 0;
static uint32_t latestId = 0;

// Settings requested over HTTP; the capture task applies them.
static volatile framesize_t requestedSize = FRAMESIZE_VGA;
static volatile int jpegQuality = 80;  // 1..100, higher is better
static volatile bool hmirror = false;
static volatile bool vflip = false;
static volatile bool ledOn = false;

// State owned by the capture task.
static volatile framesize_t currentSize = FRAMESIZE_VGA;
static volatile float captureFps = 0;
static volatile bool cameraOk = false;
static uint16_t sensorPid = 0;

static httpd_handle_t webServer = nullptr;
static httpd_handle_t streamServer = nullptr;

// Raw TCP frame server (see header comment above). Only touched by captureTask.
static const uint16_t RAW_PORT = 82;
static WiFiServer rawServer(RAW_PORT);
static WiFiClient rawClient;
static volatile bool rawClientConnected = false;  // readable from statusHandler

static bool isAllowedSize(int fs) {
  for (framesize_t s : kAllowedSizes) {
    if (s == fs) return true;
  }
  return false;
}

static bool initCamera(framesize_t size) {
  camera_config_t config = {};
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.ledc_timer = LEDC_TIMER_0;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.pixel_format = PIXFORMAT_RGB565;
  config.frame_size = size;
  config.jpeg_quality = 12;  // unused for RGB565
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.grab_mode = CAMERA_GRAB_LATEST;
  config.fb_count = size >= FRAMESIZE_XGA ? 1 : 2;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x (%s)\n", err, esp_err_to_name(err));
    return false;
  }

  sensor_t *s = esp_camera_sensor_get();
  sensorPid = s->id.PID;
  s->set_hmirror(s, hmirror);
  s->set_vflip(s, vflip);
  Serial.printf("Camera ready: sensor PID 0x%04X, %ux%u\n", sensorPid,
                resolution[size].width, resolution[size].height);
  if (sensorPid != GC2145_PID) {
    Serial.println("Note: this is not a GC2145; RGB565 capture still works on most sensors.");
  }
  return true;
}

// Growable PSRAM buffer that frame2jpg_cb() writes the encoded JPEG into.
// (frame2jpg() uses a fixed 128 KB buffer and truncates larger frames.)
struct JpgOut {
  uint8_t *data;
  size_t len;
  size_t cap;
  bool failed;
};

static size_t jpgWrite(void *arg, size_t index, const void *data, size_t len) {
  JpgOut *out = (JpgOut *)arg;
  if (out->failed) return 0;
  if (index + len > out->cap) {
    size_t cap = (index + len) * 3 / 2;
    uint8_t *grown = (uint8_t *)ps_realloc(out->data, cap);
    if (!grown) {
      out->failed = true;
      return 0;
    }
    out->data = grown;
    out->cap = cap;
  }
  memcpy(out->data + index, data, len);
  out->len = index + len;
  return len;
}

static void captureTask(void *) {
  bool appliedMirror = hmirror;
  bool appliedFlip = vflip;
  bool appliedLed = false;
  uint32_t frames = 0;
  int64_t windowStart = esp_timer_get_time();

  for (;;) {
    if (ledOn != appliedLed) {
      appliedLed = ledOn;
      digitalWrite(FLASH_LED_PIN, appliedLed ? HIGH : LOW);
    }

    framesize_t wanted = requestedSize;
    if (wanted != currentSize || !cameraOk) {
      if (cameraOk) esp_camera_deinit();
      cameraOk = initCamera(wanted);
      if (cameraOk) {
        currentSize = wanted;
      } else if (wanted != currentSize) {
        requestedSize = currentSize;  // fall back to the last working size
        continue;
      } else {
        vTaskDelay(pdMS_TO_TICKS(2000));
        continue;
      }
      appliedMirror = hmirror;
      appliedFlip = vflip;
    }

    sensor_t *s = esp_camera_sensor_get();
    if (hmirror != appliedMirror) {
      appliedMirror = hmirror;
      s->set_hmirror(s, appliedMirror);
    }
    if (vflip != appliedFlip) {
      appliedFlip = vflip;
      s->set_vflip(s, appliedFlip);
    }

    // Accept a waiting raw client (replacing any previous one - one at a time).
    if (rawServer.hasClient()) {
      if (rawClient) rawClient.stop();
      rawClient = rawServer.accept();
      rawClient.setNoDelay(true);
      rawClient.setTimeout(8000);  // ms; bounds how long a dead client can stall a write
      Serial.println("Raw TCP client connected on port 82");
    }
    rawClientConnected = rawClient && rawClient.connected();

    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Frame capture failed");
      vTaskDelay(pdMS_TO_TICKS(100));
      continue;
    }

    if (rawClientConnected) {
      // Forward raw sensor bytes as-is: no JPEG encoding, so this path is not
      // limited by the software encoder - only by Wi-Fi throughput.
      uint8_t hdr[8] = {
        (uint8_t)(fb->width & 0xFF), (uint8_t)(fb->width >> 8),
        (uint8_t)(fb->height & 0xFF), (uint8_t)(fb->height >> 8),
        (uint8_t)(fb->len & 0xFF), (uint8_t)((fb->len >> 8) & 0xFF),
        (uint8_t)((fb->len >> 16) & 0xFF), (uint8_t)((fb->len >> 24) & 0xFF),
      };
      bool ok = rawClient.write(hdr, sizeof(hdr)) == sizeof(hdr) &&
                rawClient.write(fb->buf, fb->len) == fb->len;
      esp_camera_fb_return(fb);
      if (!ok) {
        Serial.println("Raw TCP client disconnected");
        rawClient.stop();
        rawClientConnected = false;
      }
      frames++;
      int64_t now = esp_timer_get_time();
      if (now - windowStart >= 2000000) {
        captureFps = frames * 1000000.0f / (now - windowStart);
        frames = 0;
        windowStart = now;
      }
      continue;
    }

    JpgOut out = {nullptr, 0, fb->width * fb->height / 2, false};
    out.data = (uint8_t *)ps_malloc(out.cap);
    bool ok = out.data && frame2jpg_cb(fb, jpegQuality, jpgWrite, &out) && !out.failed;
    esp_camera_fb_return(fb);
    if (!ok) {
      Serial.println("JPEG encoding failed");
      free(out.data);
      vTaskDelay(pdMS_TO_TICKS(100));
      continue;
    }

    xSemaphoreTake(frameLock, portMAX_DELAY);
    uint8_t *old = latestJpg;
    latestJpg = out.data;
    latestLen = out.len;
    latestId++;
    xSemaphoreGive(frameLock);
    free(old);

    // Encoding keeps this core busy; give the Wi-Fi/HTTP tasks a turn.
    vTaskDelay(1);

    frames++;
    int64_t now = esp_timer_get_time();
    if (now - windowStart >= 2000000) {
      captureFps = frames * 1000000.0f / (now - windowStart);
      frames = 0;
      windowStart = now;
    }
  }
}

// Copies the newest frame (if newer than *lastId) into a caller-owned buffer.
static bool copyLatestFrame(uint32_t *lastId, uint8_t **buf, size_t *cap, size_t *len) {
  bool copied = false;
  xSemaphoreTake(frameLock, portMAX_DELAY);
  if (latestJpg && latestId != *lastId) {
    if (latestLen > *cap) {
      uint8_t *grown = (uint8_t *)ps_realloc(*buf, latestLen);
      if (grown) {
        *buf = grown;
        *cap = latestLen;
      }
    }
    if (latestLen <= *cap) {
      memcpy(*buf, latestJpg, latestLen);
      *len = latestLen;
      *lastId = latestId;
      copied = true;
    }
  }
  xSemaphoreGive(frameLock);
  return copied;
}

static esp_err_t indexHandler(httpd_req_t *req) {
  httpd_resp_set_type(req, "text/html");
  return httpd_resp_send(req, INDEX_HTML, HTTPD_RESP_USE_STRLEN);
}

static esp_err_t captureHandler(httpd_req_t *req) {
  uint32_t lastId = 0;
  uint8_t *buf = nullptr;
  size_t cap = 0, len = 0;
  if (!copyLatestFrame(&lastId, &buf, &cap, &len)) {
    free(buf);
    httpd_resp_set_status(req, "503 Service Unavailable");
    return httpd_resp_send(req, "No frame yet", HTTPD_RESP_USE_STRLEN);
  }
  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_set_hdr(req, "Content-Disposition", "inline; filename=capture.jpg");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  esp_err_t res = httpd_resp_send(req, (const char *)buf, len);
  free(buf);
  return res;
}

#define PART_BOUNDARY "123456789000000000000987654321"
static const char *STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char *STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
static const char *STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

static esp_err_t streamHandler(httpd_req_t *req) {
  httpd_resp_set_type(req, STREAM_CONTENT_TYPE);
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");

  uint32_t lastId = 0;
  uint8_t *buf = nullptr;
  size_t cap = 0, len = 0;
  char part[64];
  esp_err_t res = ESP_OK;

  while (res == ESP_OK) {
    if (!copyLatestFrame(&lastId, &buf, &cap, &len)) {
      vTaskDelay(pdMS_TO_TICKS(10));
      continue;
    }
    size_t hlen = snprintf(part, sizeof(part), STREAM_PART, (unsigned)len);
    res = httpd_resp_send_chunk(req, STREAM_BOUNDARY, strlen(STREAM_BOUNDARY));
    if (res == ESP_OK) res = httpd_resp_send_chunk(req, part, hlen);
    if (res == ESP_OK) res = httpd_resp_send_chunk(req, (const char *)buf, len);
  }
  free(buf);
  return res;
}

static esp_err_t statusHandler(httpd_req_t *req) {
  char json[320];
  framesize_t fs = currentSize;
  snprintf(json, sizeof(json),
           "{\"camera\":%s,\"pid\":\"0x%04X\",\"framesize\":%d,\"width\":%u,\"height\":%u,"
           "\"quality\":%d,\"hmirror\":%d,\"vflip\":%d,\"led\":%d,\"fps\":%.1f,\"frame_bytes\":%u,"
           "\"raw_port\":%u,\"raw_client\":%s,\"rssi\":%d}",
           cameraOk ? "true" : "false", sensorPid, (int)fs, resolution[fs].width,
           resolution[fs].height, jpegQuality, hmirror, vflip, ledOn, captureFps,
           (unsigned)latestLen, RAW_PORT, rawClientConnected ? "true" : "false",
           WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0);
  httpd_resp_set_type(req, "application/json");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  return httpd_resp_send(req, json, HTTPD_RESP_USE_STRLEN);
}

static esp_err_t controlHandler(httpd_req_t *req) {
  char query[64], var[16], val[16];
  if (httpd_req_get_url_query_str(req, query, sizeof(query)) != ESP_OK ||
      httpd_query_key_value(query, "var", var, sizeof(var)) != ESP_OK ||
      httpd_query_key_value(query, "val", val, sizeof(val)) != ESP_OK) {
    return httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "need var and val");
  }
  int v = atoi(val);
  if (!strcmp(var, "framesize") && isAllowedSize(v)) {
    requestedSize = (framesize_t)v;
  } else if (!strcmp(var, "quality") && v >= 1 && v <= 100) {
    jpegQuality = v;
  } else if (!strcmp(var, "hmirror")) {
    hmirror = v != 0;
  } else if (!strcmp(var, "vflip")) {
    vflip = v != 0;
  } else if (!strcmp(var, "led")) {
    ledOn = v != 0;
  } else {
    return httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "bad var or val");
  }
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  return httpd_resp_send(req, "OK", HTTPD_RESP_USE_STRLEN);
}

static void startServers() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;
  config.ctrl_port = 32768;
  httpd_uri_t routes[] = {
    {"/", HTTP_GET, indexHandler, nullptr},
    {"/capture", HTTP_GET, captureHandler, nullptr},
    {"/status", HTTP_GET, statusHandler, nullptr},
    {"/control", HTTP_GET, controlHandler, nullptr},
  };
  if (httpd_start(&webServer, &config) == ESP_OK) {
    for (httpd_uri_t &r : routes) httpd_register_uri_handler(webServer, &r);
  }

  config.server_port = 81;
  config.ctrl_port = 32769;
  httpd_uri_t stream = {"/stream", HTTP_GET, streamHandler, nullptr};
  if (httpd_start(&streamServer, &config) == ESP_OK) {
    httpd_register_uri_handler(streamServer, &stream);
  }

  rawServer.begin();
  rawServer.setNoDelay(true);
}

static void startWifi() {
  if (strlen(WIFI_SSID) > 0) {
    Serial.printf("Connecting to Wi-Fi \"%s\"", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) {
      delay(500);
      Serial.print('.');
    }
    Serial.println();
    if (WiFi.status() == WL_CONNECTED) {
      // Must be set *after* the connection is up - setting it beforehand
      // doesn't reliably stick, and modem-sleep power saving otherwise
      // causes multi-second stalls on any sustained transfer (e.g. the raw
      // pixel stream), because the radio dozes between beacon intervals.
      WiFi.setSleep(false);
      Serial.printf("Camera ready at http://%s/\n", WiFi.localIP().toString().c_str());
      return;
    }
    Serial.println("Wi-Fi connection failed, starting hotspot instead");
    WiFi.disconnect(true);
  }
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASS);
  WiFi.setSleep(false);
  Serial.printf("Hotspot \"%s\" (password \"%s\") started on channel %d, tx power %d\n",
                AP_SSID, AP_PASS, WiFi.channel(), (int)WiFi.getTxPower());
  Serial.printf("Camera ready at http://%s/\n", WiFi.softAPIP().toString().c_str());
}

void setup() {
  Serial.begin(115200);
  Serial.println();
  Serial.println("ESP32-CAM GC2145 (RHYX M21-45) web camera");

  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(FLASH_LED_PIN, LOW);

  if (!psramFound()) {
    Serial.println("PSRAM not found - enable it in the board settings. Halting.");
    while (true) delay(1000);
  }
  Serial.printf("PSRAM: %u bytes free\n", ESP.getFreePsram());

  frameLock = xSemaphoreCreateMutex();
  cameraOk = initCamera(currentSize);

  startWifi();
  startServers();

  udp.begin(5005);
  Serial.println("[CAM-02] Streaming UDP activo hacia 34.122.14.13:5005");

  // Same priority as loop() so they time-slice; below the HTTP server tasks.
  xTaskCreatePinnedToCore(captureTask, "capture", 8192, nullptr, 1, nullptr, 1);
}

static uint16_t currentFrameId = 0;
static uint32_t lastUdpSeq = 0;

static void sendBufferUDP(const uint8_t *buf, size_t len) {
  if (WiFi.status() != WL_CONNECTED || buf == NULL || len == 0) return;
  const int CHUNK_SIZE = 1024;
  int totalBytes = (int)len;
  int totalParts = (totalBytes + CHUNK_SIZE - 1) / CHUNK_SIZE;
  if (totalParts > 255) return;

  currentFrameId++;
  for (int part = 0; part < totalParts; part++) {
    int offset = part * CHUNK_SIZE;
    int thisChunkLen = min(CHUNK_SIZE, totalBytes - offset);

    udp.beginPacket("34.122.14.13", 5005);
    udp.write((const uint8_t*)"CAM-02", 6);
    udp.write((uint8_t)((currentFrameId >> 8) & 0xFF));
    udp.write((uint8_t)(currentFrameId & 0xFF));
    udp.write((uint8_t)part);
    udp.write((uint8_t)totalParts);
    udp.write((uint8_t)((thisChunkLen >> 8) & 0xFF));
    udp.write((uint8_t)(thisChunkLen & 0xFF));
    udp.write(buf + offset, thisChunkLen);
    udp.endPacket();
    delay(1);
  }
}

void loop() {
  if (WiFi.status() == WL_CONNECTED && latestBuf != nullptr && latestLen > 0 && frameSeq != lastUdpSeq) {
    if (xSemaphoreTake(frameLock, pdMS_TO_TICKS(10)) == pdTRUE) {
      size_t len = latestLen;
      uint32_t seq = frameSeq;
      uint8_t *copy = (uint8_t *)malloc(len);
      if (copy) {
        memcpy(copy, latestBuf, len);
      }
      xSemaphoreGive(frameLock);
      if (copy) {
        lastUdpSeq = seq;
        sendBufferUDP(copy, len);
        free(copy);
      }
    }
  }
  delay(5);
}
