/* ==========================================================================
   Semáforo+ · ESP32-CAM 02 (Poste Este · Calle Los Arces)
   Proyecto: TECSUP (Arequipa) · ODS 11: Ciudades y Comunidades Sostenibles
   Hardware: Módulo ESP32-CAM con Sensor RHYX-M21-45
   Pantalla: LCD 16x2 CON I2C (SDA -> GPIO 14, SCL -> GPIO 15, Dir 0x27)
   Identificador: CAM-02 (Poste Este)
   
   REFERENCIA DE COMPATIBILIDAD SENSOR:
   Basado en el driver y configuración de sandeepsonskar/esp32-RHYX-M21-45-CAM-
   - El sensor RHYX-M21-45 NO soporta compresión JPEG por hardware en el chip sensor.
   - Modo de adquisición: PIXFORMAT_RGB565 a 240x240 (FRAMESIZE_240X240) a 20MHz.
   - Conversión On-the-fly: Se realiza compresión eficiente de software (frame2jpg)
     para transmitir JPEG ultraliviano (~8-15KB) por datagramas UDP a la VPS.
   - Servidor HTTP local embebido en puerto 80 para depuración visual directa.
   - Display LCD 16x2 con I2C muestra tiempo restante y detección ML real cada 1s.
   ========================================================================== */

#include "esp_camera.h"
#include <WiFi.h>
#include <WiFiUdp.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "esp_http_server.h"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// ---------- CONFIGURACIÓN DE RED Y VERSIÓN ----------
const char* FIRMWARE_VERSION = "2.6.2-RHYX-LCD-I2C";
const char* DEVICE_TYPE      = "ESP32-CAM-ESTE";
const char* CAM_ID_STR       = "CAM-02"; // Exactamente 6 caracteres para el receptor UDP
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
const char* MQTT_CLIENT_ID     = "esp32-cam-este";
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

// Servidor HTTP local para diagnóstico
httpd_handle_t camera_httpd = NULL;

// ---------- DEFINICIÓN DE PINES AI-THINKER / RHYX-M21-45 ----------
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

// Pines periféricos auxiliares
#define LED_FLASH_PIN      4

unsigned long lastInference = 0;
TaskHandle_t udpStreamTaskHandle = NULL;

// ==============================================================================
// TRANSMISIÓN UDP ULTRA-BAJA LATENCIA (FRAGMENTADA EN CHUNKS DE 1024 BYTES)
// ==============================================================================
void sendBufferUDP(const char* camId, const uint8_t* buf, size_t len) {
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

    // Cabecera binaria de 12 bytes:
    // [0..5]:  camId ASCII (6 bytes)
    // [6..7]:  frameId (uint16)
    // [8]:     partIndex (uint8)
    // [9]:     totalParts (uint8)
    // [10..11]: chunkLen (uint16)
    udp.write((const uint8_t*)camId, 6);
    udp.write((uint8_t)((currentFrameId >> 8) & 0xFF));
    udp.write((uint8_t)(currentFrameId & 0xFF));
    udp.write((uint8_t)part);
    udp.write((uint8_t)totalParts);
    udp.write((uint8_t)((thisChunkLen >> 8) & 0xFF));
    udp.write((uint8_t)(thisChunkLen & 0xFF));

    // Datos binarios del chunk
    udp.write(buf + offset, thisChunkLen);
    udp.endPacket();
  }
}

// ==============================================================================
// TAREA FREERTOS DE STREAMING DE VIDEO
// ==============================================================================
void udpStreamTask(void * pvParameters) {
  while (true) {
    if (WiFi.status() == WL_CONNECTED) {
      camera_fb_t * fb = esp_camera_fb_get();
      if (fb) {
        if (fb->format == PIXFORMAT_JPEG) {
          // Si el sensor devolviera JPEG directamente
          sendBufferUDP(CAM_ID_STR, fb->buf, fb->len);
        } else if (fb->format == PIXFORMAT_RGB565) {
          // Sensor RHYX-M21-45: Convertir frame RGB565 a JPEG
          uint8_t * jpg_buf = NULL;
          size_t jpg_len = 0;
          if (frame2jpg(fb, 80, &jpg_buf, &jpg_len)) {
            sendBufferUDP(CAM_ID_STR, jpg_buf, jpg_len);
            free(jpg_buf);
          } else {
            // En caso excepcional enviar buffer directo
            sendBufferUDP(CAM_ID_STR, fb->buf, fb->len);
          }
        }
        esp_camera_fb_return(fb);
      }
    }
    // Cero delay artificial para máximo rendimiento, cediendo slot a otras tareas
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

// ==============================================================================
// SERVIDOR WEB HTTP LOCAL (PUERTO 80) PARA DEPURACIÓN Y PRUEBAS
// ==============================================================================
static const char PROGMEM INDEX_HTML[] = R"rawliteral(
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CAM-02 · RHYX-M21-45 (Poste Este)</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; text-align: center; margin: 0; padding: 20px; }
    .card { background: #1e293b; border-radius: 12px; padding: 20px; max-width: 500px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
    h2 { margin-top: 0; color: #38bdf8; }
    .badge { display: inline-block; background: #059669; color: white; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: bold; }
    img { width: 240px; height: 240px; border-radius: 8px; border: 2px solid #475569; margin-top: 15px; background: #000; }
    .info { text-align: left; margin-top: 15px; font-size: 13px; line-height: 1.6; color: #94a3b8; }
    .info strong { color: #f1f5f9; }
    .btn { display: inline-block; margin-top: 15px; background: #0284c7; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">ON-EDGE ACTIVO</span>
    <h2>CAM-02 · RHYX-M21-45</h2>
    <p style="margin: 4px 0 12px 0; font-size: 14px; color: #cbd5e1;">Poste Este · Cruce Av. Ejército × Calle Los Arces</p>
    <img id="liveImg" src="/jpg" alt="Video RHYX-M21-45">
    <div class="info">
      <div><strong>Sensor:</strong> RHYX-M21-45 (RGB565 240×240)</div>
      <div><strong>Streaming:</strong> UDP Datagrams -> 34.122.14.13:5005</div>
      <div><strong>Firmware:</strong> 2.6.0-RHYX (TECSUP)</div>
    </div>
    <a href="/jpg" class="btn" target="_blank">Capturar Fotograma JPEG</a>
  </div>
  <script>
    setInterval(() => {
      document.getElementById('liveImg').src = '/jpg?t=' + Date.now();
    }, 150);
  </script>
</body>
</html>
)rawliteral";

static esp_err_t index_handler(httpd_req_t *req) {
  httpd_resp_set_type(req, "text/html");
  return httpd_resp_send(req, INDEX_HTML, strlen(INDEX_HTML));
}

// Endpoint /jpg: Captura un fotograma y lo entrega como JPEG estándar
static esp_err_t jpg_handler(httpd_req_t *req) {
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }

  uint8_t * jpg_buf = NULL;
  size_t jpg_len = 0;
  bool ok = false;

  if (fb->format == PIXFORMAT_JPEG) {
    jpg_buf = fb->buf;
    jpg_len = fb->len;
    ok = true;
  } else {
    ok = frame2jpg(fb, 80, &jpg_buf, &jpg_len);
  }

  if (!ok || jpg_buf == NULL) {
    esp_camera_fb_return(fb);
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }

  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_set_hdr(req, "Cache-Control", "no-cache, no-store, must-revalidate");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  esp_err_t res = httpd_resp_send(req, (const char *)jpg_buf, jpg_len);

  if (fb->format != PIXFORMAT_JPEG) {
    free(jpg_buf);
  }
  esp_camera_fb_return(fb);
  return res;
}

// Endpoint /frame: Entrega el buffer raw RGB565 directo (estilo sandeep)
static esp_err_t raw_frame_handler(httpd_req_t *req) {
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }

  httpd_resp_set_type(req, "application/octet-stream");
  httpd_resp_set_hdr(req, "Cache-Control", "no-cache, no-store, must-revalidate");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  esp_err_t res = httpd_resp_send(req, (const char *)fb->buf, fb->len);
  esp_camera_fb_return(fb);
  return res;
}

void startLocalHttpServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;

  httpd_uri_t index_uri = {
    .uri = "/",
    .method = HTTP_GET,
    .handler = index_handler,
    .user_ctx = NULL
  };

  httpd_uri_t jpg_uri = {
    .uri = "/jpg",
    .method = HTTP_GET,
    .handler = jpg_handler,
    .user_ctx = NULL
  };

  httpd_uri_t raw_uri = {
    .uri = "/frame",
    .method = HTTP_GET,
    .handler = raw_frame_handler,
    .user_ctx = NULL
  };

  if (httpd_start(&camera_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(camera_httpd, &index_uri);
    httpd_register_uri_handler(camera_httpd, &jpg_uri);
    httpd_register_uri_handler(camera_httpd, &raw_uri);
    Serial.println("[CAM-02] Servidor HTTP local iniciado en puerto 80 (/, /jpg, /frame)");
  }
}

// ==============================================================================
// OTA UPDATE Y TELEMETRÍA CENTRAL
// ==============================================================================
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
    snprintf(line0, sizeof(line0), "E:SOS!!  T:%3ds ", remainingSec);
    snprintf(line1, sizeof(line1), "ALERTA AMBULANC.");
  } else {
    snprintf(line0, sizeof(line0), "E:%-5s  T:%3ds ", translateState(state).c_str(), remainingSec);
    snprintf(line1, sizeof(line1), "Det:%2d A:%2d C:%2d", totalDet, autos, combis);
  }
  lcd.setCursor(0, 0);
  lcd.print(line0);
  lcd.setCursor(0, 1);
  lcd.print(line1);
}

void applyDisplayJson(const String& json) {
  String laneState = extractJsonString(json, "lane2State");
  int remaining    = extractJsonInt(json, "remainingSeconds");
  int camTotal     = extractJsonInt(json, "cam2Total");
  int camAutos     = extractJsonInt(json, "cam2Autos");
  int camCombis    = extractJsonInt(json, "cam2Combis");
  int camEmerg     = extractJsonInt(json, "cam2Emergency");

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
    Serial.println("[CAM-02] MQTT conectado y suscrito a display/state.");
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

// ==============================================================================
// INICIALIZACIÓN (SETUP)
// ==============================================================================
void setup() {
  // Desactivar detector brown-out para evitar reinicios por picos de corriente
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  Serial.begin(115200);
  delay(500);

  // Inicializar LCD 16x2 I2C
  Wire.begin(LCD_I2C_SDA, LCD_I2C_SCL);
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Semaforo+ ESTE  ");
  lcd.setCursor(0, 1);
  lcd.print("Conectando WiFi ");
  Serial.println("\n=======================================================");
  Serial.println("  Semáforo+ · ESP32-CAM ESTE (CAM-02)");
  Serial.println("  Sensor: RHYX-M21-45 (RGB565 240x240 @ 20MHz)");
  Serial.printf ("  Versión Firmware: %s\n", FIRMWARE_VERSION);
  Serial.println("=======================================================");

  // Configuración de pines y protocolo para cámara RHYX-M21-45
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000; // 20 MHz (Recomendado para RHYX-M21-45)

  // FORMATO CRÍTICO PARA RHYX-M21-45:
  // El módulo RHYX-M21-45 requiere PIXFORMAT_RGB565 a 240x240
  config.pixel_format = PIXFORMAT_RGB565;
  config.frame_size   = FRAMESIZE_240X240;
  config.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;

  if (psramFound()) {
    Serial.printf("[CAM-02] PSRAM detectada: %d bytes libres.\n", ESP.getFreePsram());
    config.fb_location = CAMERA_FB_IN_PSRAM;
    config.fb_count    = 2;
  } else {
    Serial.println("[CAM-02] PSRAM no detectada. Usando DRAM interna.");
    config.fb_location = CAMERA_FB_IN_DRAM;
    config.fb_count    = 1;
  }

  // Inicializar cámara
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[CAM-02] ERROR CRÍTICO iniciando sensor RHYX: 0x%x\n", err);
    while (true) {
      delay(1000);
    }
  }
  Serial.println("[CAM-02] Sensor RHYX-M21-45 inicializado correctamente.");

  sensor_t * s = esp_camera_sensor_get();
  if (s != NULL) {
    Serial.println("[CAM-02] Sensor detectado en bus SCCB.");
  }

  // Descartar primeros fotogramas para estabilización de AGC/AEC del sensor
  for (int i = 0; i < 5; i++) {
    camera_fb_t * dummy = esp_camera_fb_get();
    if (dummy) esp_camera_fb_return(dummy);
    delay(40);
  }

  // Conexión WiFi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  WiFi.setSleep(false);

  Serial.print("[CAM-02] Conectando a red WiFi '");
  Serial.print(WIFI_SSID);
  Serial.print("'");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[CAM-02] WiFi conectado!");
  Serial.printf("[CAM-02] IP Local asignada: http://%s\n", WiFi.localIP().toString().c_str());
  Serial.printf("[CAM-02] Destino Streaming UDP: %s:%d\n", UDP_HOST, UDP_PORT);

  // Iniciar socket UDP
  udp.begin(UDP_PORT);

  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(mqttDisplayCallback);
  mqttClient.setBufferSize(512);

  // Iniciar servidor HTTP local para pruebas
  startLocalHttpServer();

  // Iniciar tarea de streaming UDP en segundo plano (Core 0)
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

// ==============================================================================
// BUCLE PRINCIPAL (LOOP)
// ==============================================================================
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
