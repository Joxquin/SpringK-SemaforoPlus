# Firmware ESP32 & ESP32-CAM · Semáforo+ (TECSUP Arequipa)

Este directorio contiene el código fuente nativo de Arduino (`.ino`) para el hardware embebido del sistema adaptativo **Semáforo+**:

```
firmware/
├── esp32_central_controller/
│   └── esp32_central_controller.ino     # Firmware del ESP32 Central ("Cerebro del Cruce")
├── esp32_cam_norte/
│   └── esp32_cam_norte.ino              # Firmware de CAM-01 (Poste Norte · Av. Ejército)
├── esp32_cam_este/
│   └── esp32_cam_este.ino               # Firmware de CAM-02 (Poste Este · Calle Los Arces)
└── README.md
```

---

## 1. ESP32 Central Controller (`esp32_central_controller.ino`)
Controla directamente los **2 semáforos** del cruce físico y procesa el algoritmo adaptativo de manera **100% local**:

### Asignación de Pines (GPIOs):
| Dispositivo / Función | Pin GPIO (ESP32) | Tipo | Descripción |
| :--- | :--- | :--- | :--- |
| **SEM-01 Rojo (Av. Ejército)** | `GPIO 23` | Salida Digital | Luz roja carril principal |
| **SEM-01 Amarillo (Av. Ejército)** | `GPIO 22` | Salida Digital | Luz ámbar carril principal |
| **SEM-01 Verde (Av. Ejército)** | `GPIO 21` | Salida Digital | Luz verde carril principal |
| **SEM-02 Rojo (Los Arces)** | `GPIO 19` | Salida Digital | Luz roja carril secundario |
| **SEM-02 Amarillo (Los Arces)** | `GPIO 18` | Salida Digital | Luz ámbar carril secundario |
| **SEM-02 Verde (Los Arces)** | `GPIO 5` | Salida Digital | Luz verde carril secundario |
| **Sensor Voltaje Batería Solar** | `GPIO 34` | Entrada Analógica | Divisor resistivo 100k/33k LiFePO4 |

### Parámetros de Seguridad:
- **Tiempo verde mínimo**: 15 segundos (garantía de cruce peatonal seguro).
- **Tiempo verde máximo**: 60 segundos (evita congestionamiento indefinido).
- **Tiempo ámbar / amarillo**: 3 segundos.
- **Despeje todo rojo**: 2 segundos.
- **Failover**: Si se pierde la conexión WiFi o a internet, el ESP32 **continúa operando localmente** sin pausas.

---

## 2. Módulos ESP32-CAM (`esp32_cam_norte.ino` y `esp32_cam_este.ino`)
- **CAM-01 (Poste Norte · Av. Ejército)**: Placa AI-Thinker ESP32-CAM con sensor estándar OV2640 y PSRAM. Formato JPEG por hardware.
- **CAM-02 (Poste Este · Calle Los Arces)**: Módulo ESP32-CAM con sensor **RHYX-M21-45**. Formato nativo `PIXFORMAT_RGB565` a 240×240 a 20MHz con compresión ultraliviana `frame2jpg` hacia streaming UDP (basado en el driver de `sandeepsonskar/esp32-RHYX-M21-45-CAM-`).
- Transmite datagramas UDP de video en tiempo real hacia:
  `UDP 34.122.14.13:5005` (identificadores `CAM-01` y `CAM-02`).
- Servidor HTTP embebido en puerto 80 para diagnóstico visual local (`http://<IP_LOCAL>/`).
- Transmite los conteos clasificados hacia el servidor:
  `POST http://34.122.14.13/api/v1/iot/cam/detection`

---

## 3. Instrucciones de Compilación y Flasheo Automático (Arch Linux)

Para automatizar el proceso al máximo sin abrir interfaces gráficas pesadas:

### Preparación única en tu Arch Linux:
```bash
sudo pacman -S arduino-cli esptool python-pyserial
sudo usermod -aG uucp $USER

# Configurar core de ESP32 en arduino-cli
arduino-cli config init
arduino-cli config add board_manager.additional_urls https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
arduino-cli core update-index
arduino-cli core install esp32:esp32
```

### Ejecutar el Flasheador Automático:
Conecta tu ESP32 o ESP32-CAM por cable USB y ejecuta:
```bash
./firmware/scripts/flash.sh
```
El script:
1. Detecta automáticamente el puerto (`/dev/ttyUSB0`, `/dev/ttyACM0`, etc.).
2. Te permite elegir qué componente flashear (`Central`, `CAM Norte`, `CAM Este`).
3. Compila con los flags optimizados de la placa.
4. Flashea el binario vía `arduino-cli`.
5. Abre el monitor serial en vivo para ver la telemetría en tiempo real.


1. **Requisitos en Arduino IDE**:
   - Instalar el paquete de placas ESP32 por Espressif (`https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`).
   - Para el controlador central: Seleccionar placa `ESP32 Dev Module`.
   - Para las cámaras: Seleccionar placa `AI Thinker ESP32-CAM` (deshabilitar Brownout detector si la fuente de 5V tiene caída).
2. **Configuración de Variables de Red**:
   En cada `.ino`, actualizar:
   ```cpp
   const char* WIFI_SSID     = "Tu_Red_WiFi";
   const char* WIFI_PASSWORD = "Tu_Password_WiFi";
   const char* SERVER_URL    = "http://<IP_VPS_O_SERVIDOR>:8080/api/v1/iot/...";
   ```
3. **Flashear vía USB**:
   - Conectar mediante convertidor USB-TTL (FTDI a 3.3V o 5V según el módulo).
   - En el ESP32-CAM, puentear `GPIO 0` con `GND` para entrar en modo *Flash*.
