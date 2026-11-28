#include "esp_camera.h"
#include <WiFi.h>
#include <WiFiUdp.h>

#define CAMERA_MODEL_AI_THINKER // Has PSRAM

#include "camera_pins.h"

// ===========================
// Enter your WiFi credentials
// ===========================
const char *ssid = "S24";
const char *password = "122344566";

const char *UDP_HOST = "34.122.14.13";
const int   UDP_PORT = 5005;
const char *CAM_ID_STR = "CAM-02";

WiFiUDP udp;
uint16_t currentFrameId = 0;

void sendBufferUDP(const uint8_t *buf, size_t len) {
  if (WiFi.status() != WL_CONNECTED || buf == NULL || len == 0) return;
  const int CHUNK_SIZE = 1024;
  int totalBytes = (int)len;
  int totalParts = (totalBytes + CHUNK_SIZE - 1) / CHUNK_SIZE;
  if (totalParts > 255) return;

  currentFrameId++;
  for (int part = 0; part < totalParts; part++) {
    int offset = part * CHUNK_SIZE;
    int thisChunkLen = min(CHUNK_SIZE, totalBytes - offset);

    udp.beginPacket(UDP_HOST, UDP_PORT);
    udp.write((const uint8_t*)CAM_ID_STR, 6);
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

void sendFrameUDP(camera_fb_t *fb) {
  if (WiFi.status() != WL_CONNECTED || fb == NULL) return;
  if (fb->format == PIXFORMAT_JPEG) {
    sendBufferUDP(fb->buf, fb->len);
  } else {
    uint8_t *jpg_buf = NULL;
    size_t jpg_len = 0;
    if (frame2jpg(fb, 85, &jpg_buf, &jpg_len)) {
      sendBufferUDP(jpg_buf, jpg_len);
      free(jpg_buf);
    }
  }
}

void startCameraServer();

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
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.frame_size = FRAMESIZE_240X240;
  config.pixel_format = PIXFORMAT_RGB565; // for face detection/recognition
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.fb_count = 2;
 
  // camera init
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }

  sensor_t * s = esp_camera_sensor_get();

  WiFi.begin(ssid, password);
  WiFi.setSleep(false);

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
  Serial.printf("[CAM-02] Streaming UDP activo hacia %s:%d\n", UDP_HOST, UDP_PORT);
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    camera_fb_t *fb = esp_camera_fb_get();
    if (fb) {
      sendFrameUDP(fb);
      esp_camera_fb_return(fb);
    }
  }
  delay(5);
}
