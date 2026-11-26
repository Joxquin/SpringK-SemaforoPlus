/* ==========================================================================
   Semáforo+ · ESP32-CAM 01 (Poste Norte · Av. Ejército)
   Proyecto: TECSUP (Arequipa) · ODS 11: Ciudades y Comunidades Sostenibles
   Hardware: Módulo AI-Thinker ESP32-CAM (Sensor OV2640 + 4MB PSRAM)
   Pantalla: LCD 16x2 CON I2C (SDA -> GPIO 14, SCL -> GPIO 15, Dir 0x27)
   
   Streaming: Protocolo UDP Ultra-Baja Latencia (Calibrado de Fábrica)
   Destino:   34.122.14.13:5005 (VPS Cloud)
   Display:   Consulta tiempo restante y detección ML real cada 1 segundo
   ========================================================================== */

#include "esp_camera.h"
#include <WiFi.h>
#include <WiFiUdp.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// ---------- CONFIGURACIÓN DE RED Y VERSIÓN ----------
const char* FIRMWARE_VERSION = "2.6.0-LCD-I2C";
const char* DEVICE_TYPE      = "ESP32-CAM-NORTE";
const char* CAM_ID_STR       = "CAM-01"; // Exactamente 6 caracteres
const char* WIFI_SSID        = "S24";
const char* WIFI_PASSWORD    = "122344566";

// Destino UDP y Servidor Central (Cloud VPS)
const char* UDP_HOST         = "34.122.14.13";
const int   UDP_PORT         = 5005;

const String SERVER_HOST     = "http://34.122.14.13";
const String COMMAND_URL     = SERVER_HOST + "/api/v1/iot/esp32/command";
const String OTA_BIN_URL     = SERVER_HOST + "/api/v1/iot/firmware/download/" + DEVICE_TYPE;

// ---------- CONFIGURACIÓN MQTT (SOLO DISPLAY / TELEMETRÍA) ----------
const char* MQTT_HOST          = "34.122.14.13";
const int   MQTT_PORT          = 1883;
const char* MQTT_USER          = "joxquin";
const char* MQTT_PASS          = "Joxquin123";
const char* MQTT_CLIENT_ID     = "esp32-cam-norte";
const char* MQTT_TOPIC_DISPLAY = "semaforoplus/node-01/display/state";

WiFiClient mqttWifiClient;
PubSubClient mqttClient(mqttWifiClient);
unsigned long lastMqttReconnectAttempt = 0;

// ---------- CONFIGURACIÓN LCD 16x2 I2C (Pines libres SD del ESP32-CAM) ----------
#define LCD_I2C_SDA   14
#define LCD_I2C_SCL   15
#define LCD_I2C_ADDR  0x27  // Cambiar a 0x3F si tu módulo PCF8574 usa esa dirección
LiquidCrystal_I2C lcd(LCD_I2C_ADDR, 16, 2);

// Instancia UDP
WiFiUDP udp;
uint16_t currentFrameId = 0;

// ---------- DEFINICIÓN DE PINES AI-THINKER ESP32-CAM ----------
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27

#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

unsigned long lastInference = 0;
TaskHandle_t udpStreamTaskHandle = NULL;

// Envío de fotograma JPEG fragmentado por datagramas UDP (MTU seguro de 1024 bytes)
void sendFrameUDP(camera_fb_t * fb) {
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

// Tarea FreeRTOS de transmisión inmediata: entrega CADA fotograma que produce el hardware
void udpStreamTask(void * pvParameters) {
  while (true) {
    if (WiFi.status() == WL_CONNECTED) {
      camera_fb_t * fb = esp_camera_fb_get();
      if (fb) {
        sendFrameUDP(fb);
        esp_camera_fb_return(fb);
      }
    }
    // Cero retraso artificial: cede inmediatamente el control al planificador (0 ticks)
    // para capturar el siguiente fotograma tan pronto como el DMA lo tenga listo
    vTaskDelay(0);
  }
}

void executeOTAUpdate() {
  Serial.println("\n[OTA] ¡Orden de actualización recibida desde la VPS!");
  WiFiClient client;
  t_httpUpdate_return ret = httpUpdate.update(client, OTA_BIN_URL);
  if (ret == HTTP_UPDATE_OK) {
    Serial.println("[OTA] Actualización exitosa. Reiniciando...");
  }
}

String extractJsonString(const String& json, const String& key) {
  String pattern = "\"" + key + "\":\"";
  int start = json.indexOf(pattern);
  if (start < 0) return "";
  start += pattern.length();
  int end = json.indexOf("\"", start);
  if (end < 0) return "";
  return json.substring(start, end);
}

int extractJsonInt(const String& json, const String& key) {
  String pattern = "\"" + key + "\":";
  int start = json.indexOf(pattern);
  if (start < 0) return 0;
  start += pattern.length();
  int end = start;
  while (end < (int)json.length() && (isDigit(json[end]) || json[end] == '-')) {
    end++;
  }
  if (end == start) return 0;
  return json.substring(start, end).toInt();
}

String translateState(const String& st) {
  if (st == "GREEN")  return "VERDE";
  if (st == "YELLOW") return "AMBAR";
  if (st == "RED")    return "ROJO ";
  return st.length() > 5 ? st.substring(0, 5) : st;
}

void updateLcdDisplay(const String& state, int remainingSec, int totalDet, int autos, int combis, int emerg) {
  char line0[17];
  char line1[17];
  if (emerg > 0) {
    snprintf(line0, sizeof(line0), "N:SOS!!  T:%3ds ", remainingSec);
    snprintf(line1, sizeof(line1), "ALERTA AMBULANC.");
  } else {
    snprintf(line0, sizeof(line0), "N:%-5s  T:%3ds ", translateState(state).c_str(), remainingSec);
    snprintf(line1, sizeof(line1), "Det:%2d A:%2d C:%2d", totalDet, autos, combis);
  }
  lcd.setCursor(0, 0);
  lcd.print(line0);
  lcd.setCursor(0, 1);
  lcd.print(line1);
}

void applyDisplayJson(const String& json) {
  String laneState = extractJsonString(json, "lane1State");
  int remaining    = extractJsonInt(json, "remainingSeconds");
  int camTotal     = extractJsonInt(json, "cam1Total");
  int camAutos     = extractJsonInt(json, "cam1Autos");
  int camCombis    = extractJsonInt(json, "cam1Combis");
  int camEmerg     = extractJsonInt(json, "cam1Emergency");

  if (laneState.length() > 0) {
    updateLcdDisplay(laneState, remaining, camTotal, camAutos, camCombis, camEmerg);
  }
}

void mqttDisplayCallback(char* topic, byte* payload, unsigned int length) {
  String json;
  json.reserve(length);
  for (unsigned int i = 0; i < length; i++) {
    json += (char)payload[i];
  }
  applyDisplayJson(json);
}

void ensureMqttConnected() {
  if (mqttClient.connected()) return;
  if (mqttClient.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASS)) {
    mqttClient.subscribe(MQTT_TOPIC_DISPLAY);
    Serial.println("[CAM-01] MQTT conectado y suscrito a display/state.");
  }
}

void syncTrafficAndDisplay() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.setTimeout(1500);
  http.begin(COMMAND_URL);
  int code = http.GET();

  if (code == HTTP_CODE_OK) {
    applyDisplayJson(http.getString());
  }
  http.end();
}

void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  Serial.begin(115200);
  delay(500);
  Serial.println("\n[CAM-01] Iniciando ESP32-CAM con LCD I2C...");

  // Inicializar LCD 16x2 I2C
  Wire.begin(LCD_I2C_SDA, LCD_I2C_SCL);
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Semaforo+ NORTE ");
  lcd.setCursor(0, 1);
  lcd.print("Conectando WiFi ");

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
  config.xclk_freq_hz = 20000000;
  config.frame_size = FRAMESIZE_UXGA;
  config.pixel_format = PIXFORMAT_JPEG;
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = 12;
  config.fb_count = 1;

  if (psramFound()) {
    Serial.printf("[CAM-01] PSRAM detectada: %d bytes libres.\n", ESP.getFreePsram());
    config.jpeg_quality = 12; // Calidad nítida comprobada
    config.fb_count = 2;
    config.grab_mode = CAMERA_GRAB_LATEST;
  } else {
    Serial.println("[CAM-01] ADVERTENCIA: PSRAM NO detectada.");
    config.frame_size = FRAMESIZE_SVGA;
    config.fb_location = CAMERA_FB_IN_DRAM;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[CAM-01] Error iniciando cámara: 0x%x\n", err);
    return;
  }

  sensor_t * s = esp_camera_sensor_get();
  if (s != NULL) {
    if (s->id.PID == OV3660_PID) {
      s->set_vflip(s, 1);
      s->set_brightness(s, 1);
      s->set_saturation(s, -2);
    }
    // FRAMESIZE_QVGA (320x240) - Resolución nítida y perfectamente soportada
    s->set_framesize(s, FRAMESIZE_QVGA);
    s->set_vflip(s, 1);
    s->set_hmirror(s, 0);
  }

  // Dejar que el sensor haga 5 lecturas para calibrar exposición
  for (int i = 0; i < 5; i++) {
    camera_fb_t * dummy = esp_camera_fb_get();
    if (dummy) esp_camera_fb_return(dummy);
    delay(50);
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  WiFi.setSleep(false);

  Serial.print("[CAM-01] Conectando a WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("");
  Serial.println("[CAM-01] WiFi conectado con éxito!");
  Serial.printf("[CAM-01] Transmitiendo video UDP a %s:%d\n", UDP_HOST, UDP_PORT);

  udp.begin(UDP_PORT);

  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(mqttDisplayCallback);
  mqttClient.setBufferSize(512);

  // Crear Tarea FreeRTOS para streaming UDP en Core 0
  xTaskCreatePinnedToCore(
    udpStreamTask,
    "udpStreamTask",
    4096,
    NULL,
    1,
    &udpStreamTaskHandle,
    0
  );
}

void loop() {
  unsigned long now = millis();

  if (WiFi.status() == WL_CONNECTED) {
    if (!mqttClient.connected()) {
      if (now - lastMqttReconnectAttempt >= 5000) {
        lastMqttReconnectAttempt = now;
        ensureMqttConnected();
      }
      // Respaldo HTTP cada 1 segundo si MQTT aún no está conectado
      if (now - lastInference >= 1000) {
        lastInference = now;
        syncTrafficAndDisplay();
      }
    } else {
      mqttClient.loop();
    }
  }

  delay(50);
}
