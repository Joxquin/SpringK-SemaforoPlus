#include <Arduino.h>
#include "esp_camera.h"
#include <WiFi.h>
#include <WiFiUdp.h>

// ===========================
// Select camera model in board_config.h
// ===========================
#include "board_config.h"

// ===========================
// Credenciales WiFi y Servidor UDP
// ===========================
const char *ssid = "S24";
const char *password = "122344566";

const char *UDP_HOST = "34.122.14.13";
const int   UDP_PORT = 5005;
const char *CAM_ID_STR = "CAM-01"; // Exactamente 6 caracteres para el backend

WiFiUDP udp;
uint16_t currentFrameId = 0;
unsigned long lastUdpFrameTime = 0;
const unsigned long UDP_FRAME_INTERVAL_MS = 66; // ~15 FPS estables sin saturar WiFi

void startCameraServer();
void setupLedFlash();

void sendFrameUDP(camera_fb_t *fb) {
  if (WiFi.status() != WL_CONNECTED || fb == NULL) return;

  const int CHUNK_SIZE = 1024;
  int totalBytes = fb->len;
  int totalParts = (totalBytes + CHUNK_SIZE - 1) / CHUNK_SIZE;
  if (totalParts > 255) return;

  currentFrameId++;

  for (int part = 0; part < totalParts; part++) {
    int offset = part * CHUNK_SIZE;
    int thisChunkLen = min(CHUNK_SIZE, totalBytes - offset);

    udp.beginPacket(UDP_HOST, UDP_PORT);

    // Cabecera binaria de 12 bytes
    udp.write((const uint8_t*)CAM_ID_STR, 6);
    udp.write((uint8_t)((currentFrameId >> 8) & 0xFF));
    udp.write((uint8_t)(currentFrameId & 0xFF));
    udp.write((uint8_t)part);
    udp.write((uint8_t)totalParts);
    udp.write((uint8_t)((thisChunkLen >> 8) & 0xFF));
    udp.write((uint8_t)(thisChunkLen & 0xFF));

    // Datos binarios JPEG del chunk
    udp.write(fb->buf + offset, thisChunkLen);
    udp.endPacket();
  }
}

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  Serial.println();

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 16000000;
  config.frame_size = FRAMESIZE_UXGA;
  config.pixel_format = PIXFORMAT_JPEG;  // for streaming
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = 12;
  config.fb_count = 1;
  config.jpeg_buffer_size = 0;

  // if PSRAM IC present, init with UXGA resolution and higher JPEG quality
  //                      for larger pre-allocated frame buffer.
  if (config.pixel_format == PIXFORMAT_JPEG) {
    if (psramFound()) {
      config.jpeg_quality = 10;
      config.fb_count = 2;
      config.grab_mode = CAMERA_GRAB_LATEST;
    } else {
      // Limit the frame size when PSRAM is not available
      config.frame_size = FRAMESIZE_SVGA;
      config.fb_location = CAMERA_FB_IN_DRAM;
    }
  } else {
    config.frame_size = FRAMESIZE_240X240;
#if CONFIG_IDF_TARGET_ESP32S3
    config.fb_count = 2;
#endif
  }

#if defined(CAMERA_MODEL_ESP_EYE)
  pinMode(13, INPUT_PULLUP);
  pinMode(14, INPUT_PULLUP);
#endif

  // camera init
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }

  sensor_t *s = esp_camera_sensor_get();
  // initial sensors are flipped vertically and colors are a bit saturated
  if (s->id.PID == OV3660_PID) {
    s->set_vflip(s, 1);        // flip it back
    s->set_brightness(s, 1);   // up the brightness just a bit
    s->set_saturation(s, -2);  // lower the saturation
  }
  // drop down frame size for higher initial frame rate
  if (config.pixel_format == PIXFORMAT_JPEG) {
    s->set_framesize(s, FRAMESIZE_QVGA);
  }

#if defined(CAMERA_MODEL_M5STACK_WIDE) || defined(CAMERA_MODEL_M5STACK_ESP32CAM)
  s->set_vflip(s, 1);
  s->set_hmirror(s, 1);
#endif

#if defined(CAMERA_MODEL_ESP32S3_EYE)
  s->set_vflip(s, 1);
#endif

// Setup LED FLash if LED pin is defined in camera_pins.h
#if defined(LED_GPIO_NUM)
  setupLedFlash();
#endif

  WiFi.begin(ssid, password);
  WiFi.setSleep(false);

  Serial.print("WiFi connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("");
  Serial.println("WiFi connected");

  startCameraServer();

  Serial.print("Camera Ready! Use 'http://");
  Serial.print(WiFi.localIP());
  Serial.println("' to connect");

  udp.begin(UDP_PORT);
  Serial.printf("[CAM-01] UDP Streaming listo hacia %s:%d\n", UDP_HOST, UDP_PORT);
}

void loop() {
  unsigned long now = millis();
  if (WiFi.status() == WL_CONNECTED) {
    if (now - lastUdpFrameTime >= UDP_FRAME_INTERVAL_MS) {
      lastUdpFrameTime = now;
      camera_fb_t *fb = esp_camera_fb_get();
      if (fb) {
        sendFrameUDP(fb);
        esp_camera_fb_return(fb);
      }
    }
  }
  delay(5);
}
