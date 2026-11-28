package edu.tecsup.semaforoplus.iot.service;

import edu.tecsup.semaforoplus.iot.dto.CamDetectionPayload;
import edu.tecsup.semaforoplus.iot.dto.Esp32CentralPayload;
import edu.tecsup.semaforoplus.iot.dto.TrafficControlPayload;
import edu.tecsup.semaforoplus.iot.model.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class HardwareStateService {
    private static final Logger log = LoggerFactory.getLogger(HardwareStateService.class);
    private static final long ESP32_TIMEOUT_SECONDS = 10L;
    private static final long CAM_TIMEOUT_SECONDS = 5L;

    private final RestClient restClient;
    private final UdpVideoService udpVideoService;

    @Value("${traffic-core.url:http://localhost:8082}")
    private String trafficCoreUrl;

    private volatile Instant lastEsp32Heartbeat;
    private volatile Instant lastCam1Heartbeat;
    private volatile Instant lastCam2Heartbeat;

    private volatile String esp32Ip = "192.168.1.50";
    private volatile String cam1Ip = "192.168.1.51";
    private volatile String cam2Ip = "192.168.1.52";

    private volatile String currentPhase = "STANDBY";
    private volatile LightState sem1State = LightState.STANDBY;
    private volatile LightState sem2State = LightState.STANDBY;
    private volatile int sem1Remaining = 0;
    private volatile int sem2Remaining = 0;
    private volatile int sem1GreenAllocated = 25;
    private volatile int sem2GreenAllocated = 20;
    private volatile String controlMode = "STANDBY";
    private volatile boolean emergencyActive = false;
    private volatile String emergencyCamId = null;

    private volatile double batteryVoltage = 0.0;
    private volatile int batteryPercent = 0;
    private volatile double solarPowerWatts = 0.0;
    private volatile double autonomyHours = 0.0;
    private volatile String powerSource = "SIN_TELEMETRIA";

    private final Map<String, VehicleClassification> camClassifications = new ConcurrentHashMap<>();
    private final Map<String, Integer> camFps = new ConcurrentHashMap<>();
    private final Map<String, Integer> camLatency = new ConcurrentHashMap<>();
    private final Map<String, Double> camConfidence = new ConcurrentHashMap<>();

    public HardwareStateService(RestClient restClient, UdpVideoService udpVideoService) {
        this.restClient = restClient;
        this.udpVideoService = udpVideoService;
        camClassifications.put("CAM-01", VehicleClassification.empty());
        camClassifications.put("CAM-02", VehicleClassification.empty());
    }

    private boolean isAlive(Instant lastHeartbeat, long timeoutSeconds) {
        if (lastHeartbeat == null) {
            return false;
        }
        return Instant.now().minusSeconds(timeoutSeconds).isBefore(lastHeartbeat);
    }

    public boolean isEsp32Online() {
        return isAlive(lastEsp32Heartbeat, ESP32_TIMEOUT_SECONDS);
    }

    public boolean isCamOnline(String camId) {
        Instant hb = "CAM-01".equals(camId) ? lastCam1Heartbeat : lastCam2Heartbeat;
        return isAlive(hb, CAM_TIMEOUT_SECONDS) || udpVideoService.hasRecentFrame(camId, CAM_TIMEOUT_SECONDS * 1000L);
    }

    public void markEsp32Status(String status) {
        if ("online".equalsIgnoreCase(status)) {
            lastEsp32Heartbeat = Instant.now();
        } else if ("offline".equalsIgnoreCase(status)) {
            lastEsp32Heartbeat = null;
        }
    }

    public void updateEsp32Telemetry(Esp32CentralPayload payload) {
        lastEsp32Heartbeat = Instant.now();
        if (payload.ipAddress() != null && !payload.ipAddress().isBlank()) {
            esp32Ip = payload.ipAddress();
        }
        if (payload.batteryVoltage() != null) {
            batteryVoltage = payload.batteryVoltage();
        }
        if (payload.batteryPercent() != null) {
            batteryPercent = payload.batteryPercent();
        }
        if (payload.solarPowerWatts() != null) {
            solarPowerWatts = payload.solarPowerWatts();
        }
        if (payload.autonomyHours() != null) {
            autonomyHours = payload.autonomyHours();
        }
        if (payload.powerSource() != null && !payload.powerSource().isBlank()) {
            powerSource = payload.powerSource();
        }
        if (payload.sem1State() != null && "STANDBY".equals(currentPhase)) {
            sem1State = parseLightState(payload.sem1State());
        }
        if (payload.sem2State() != null && "STANDBY".equals(currentPhase)) {
            sem2State = parseLightState(payload.sem2State());
        }
        if (payload.sem1Remaining() != null && "STANDBY".equals(currentPhase)) {
            sem1Remaining = payload.sem1Remaining();
        } else if (payload.remainingSeconds() != null && "STANDBY".equals(currentPhase)) {
            sem1Remaining = payload.remainingSeconds();
        }
        if (payload.sem2Remaining() != null && "STANDBY".equals(currentPhase)) {
            sem2Remaining = payload.sem2Remaining();
        } else if (payload.remainingSeconds() != null && "STANDBY".equals(currentPhase)) {
            sem2Remaining = payload.remainingSeconds();
        }
        forwardTelemetryToCore(payload);
    }

    public void updateCamDetection(CamDetectionPayload payload) {
        String camId = payload.camId() != null ? payload.camId() : "CAM-01";
        Instant now = Instant.now();
        if ("CAM-01".equals(camId)) {
            lastCam1Heartbeat = now;
            if (payload.ipAddress() != null && !payload.ipAddress().isBlank()) {
                cam1Ip = payload.ipAddress();
            }
        } else if ("CAM-02".equals(camId)) {
            lastCam2Heartbeat = now;
            if (payload.ipAddress() != null && !payload.ipAddress().isBlank()) {
                cam2Ip = payload.ipAddress();
            }
        }

        VehicleClassification vc = new VehicleClassification(
                payload.autos() != null ? payload.autos() : 0,
                payload.combis() != null ? payload.combis() : 0,
                payload.unidadesEmergencia() != null ? payload.unidadesEmergencia() : 0
        );
        camClassifications.put(camId, vc);
        camFps.put(camId, payload.fps() != null ? payload.fps() : 0);
        camLatency.put(camId, payload.inferenceLatencyMs() != null ? payload.inferenceLatencyMs() : 0);
        camConfidence.put(camId, payload.confidenceAvg() != null ? payload.confidenceAvg() : 0.0);

        if (vc.hasEmergencyVehicle()) {
            emergencyActive = true;
            emergencyCamId = camId;
        }

        forwardDetectionToCore(payload);
    }

    public void applyTrafficControl(TrafficControlPayload payload) {
        currentPhase = payload.phase();
        sem1State = parseLightState(payload.sem1State());
        sem2State = parseLightState(payload.sem2State());
        sem1Remaining = payload.sem1Remaining();
        sem2Remaining = payload.sem2Remaining();
        sem1GreenAllocated = payload.sem1GreenAllocated();
        sem2GreenAllocated = payload.sem2GreenAllocated();
        controlMode = payload.mode();
        emergencyActive = payload.emergencyActive();
        emergencyCamId = payload.emergencyCamId();
    }

    public void triggerEmergency(String camId) {
        emergencyActive = true;
        emergencyCamId = camId;
    }

    public void resetEmergency() {
        emergencyActive = false;
        emergencyCamId = null;
    }

    public void disconnectAll() {
        lastEsp32Heartbeat = null;
        lastCam1Heartbeat = null;
        lastCam2Heartbeat = null;
        currentPhase = "STANDBY";
        sem1State = LightState.STANDBY;
        sem2State = LightState.STANDBY;
        sem1Remaining = 0;
        sem2Remaining = 0;
        batteryVoltage = 0.0;
        batteryPercent = 0;
        solarPowerWatts = 0.0;
        autonomyHours = 0.0;
        powerSource = "SIN_TELEMETRIA";
        camClassifications.put("CAM-01", VehicleClassification.empty());
        camClassifications.put("CAM-02", VehicleClassification.empty());
        emergencyActive = false;
        emergencyCamId = null;
    }

    public TrafficNodeStatus getNodeStatus() {
        boolean espOnline = isEsp32Online();
        boolean cam1Online = isCamOnline("CAM-01");
        boolean cam2Online = isCamOnline("CAM-02");
        boolean anyOnline = espOnline || cam1Online || cam2Online;

        String offlineMsg = buildOfflineMessage(espOnline, cam1Online, cam2Online);
        String nowStr = Instant.now().toString();

        TrafficLightStatus sem1 = new TrafficLightStatus(
                "SEM-01",
                "Semáforo Norte",
                "Av. Ejército",
                espOnline ? sem1State : LightState.STANDBY,
                espOnline ? (sem1State == LightState.RED ? PedestrianState.WALK : PedestrianState.DONT_WALK) : PedestrianState.STANDBY,
                espOnline ? sem1Remaining : 0,
                sem1GreenAllocated,
                espOnline ? controlMode : "STANDBY",
                espOnline,
                lastEsp32Heartbeat != null ? lastEsp32Heartbeat.toString() : null
        );

        TrafficLightStatus sem2 = new TrafficLightStatus(
                "SEM-02",
                "Semáforo Este",
                "Calle Los Arces",
                espOnline ? sem2State : LightState.STANDBY,
                espOnline ? (sem2State == LightState.RED ? PedestrianState.WALK : PedestrianState.DONT_WALK) : PedestrianState.STANDBY,
                espOnline ? sem2Remaining : 0,
                sem2GreenAllocated,
                espOnline ? controlMode : "STANDBY",
                espOnline,
                lastEsp32Heartbeat != null ? lastEsp32Heartbeat.toString() : null
        );

        Esp32CamStatus cam1 = buildCamStatus("CAM-01", "ESP32-CAM Norte", "Av. Ejército", cam1Ip, cam1Online, lastCam1Heartbeat);
        Esp32CamStatus cam2 = buildCamStatus("CAM-02", "ESP32-CAM Este", "Calle Los Arces", cam2Ip, cam2Online, lastCam2Heartbeat);

        SolarBackupStatus solar = espOnline
                ? new SolarBackupStatus(true, batteryVoltage, batteryPercent, solarPowerWatts, autonomyHours, powerSource, "Respaldo solar activo")
                : new SolarBackupStatus(false, 0.0, 0, 0.0, 0.0, "SIN_TELEMETRIA", "Sin telemetría de hardware");

        SafetyLimits limits = new SafetyLimits(15, 60, 3, 2, 10);

        return new TrafficNodeStatus(
                "NODE-01",
                "Av. Ejército × Calle Los Arces (Yanahuara)",
                esp32Ip,
                anyOnline,
                espOnline ? "CONECTADO" : "DESCONECTADO",
                offlineMsg,
                emergencyActive,
                emergencyCamId,
                espOnline ? currentPhase : "STANDBY",
                List.of(sem1, sem2),
                List.of(cam1, cam2),
                solar,
                limits,
                nowStr
        );
    }

    private Esp32CamStatus buildCamStatus(String id, String name, String avenue, String ip, boolean online, Instant hb) {
        VehicleClassification vc = online
                ? camClassifications.getOrDefault(id, VehicleClassification.empty())
                : VehicleClassification.empty();
        return new Esp32CamStatus(
                id,
                name,
                avenue,
                ip,
                online,
                online ? "ACTIVA (YOLOv8)" : "DESCONECTADA (Sin señal)",
                online ? camFps.getOrDefault(id, 0) : 0,
                online ? camLatency.getOrDefault(id, 0) : 0,
                online ? camConfidence.getOrDefault(id, 0.0) : 0.0,
                vc,
                hb != null ? hb.toString() : null
        );
    }

    private String buildOfflineMessage(boolean espOnline, boolean cam1Online, boolean cam2Online) {
        if (espOnline && cam1Online && cam2Online) {
            return null;
        }
        StringBuilder sb = new StringBuilder("Dispositivos sin señal: ");
        boolean first = true;
        if (!espOnline) {
            sb.append("ESP32 Central (SEM-01/SEM-02)");
            first = false;
        }
        if (!cam1Online) {
            if (!first) sb.append(", ");
            sb.append("ESP32-CAM Norte (CAM-01)");
            first = false;
        }
        if (!cam2Online) {
            if (!first) sb.append(", ");
            sb.append("ESP32-CAM Este (CAM-02)");
        }
        return sb.toString();
    }

    private LightState parseLightState(String raw) {
        if (raw == null) return LightState.STANDBY;
        try {
            return LightState.valueOf(raw.toUpperCase());
        } catch (IllegalArgumentException e) {
            return LightState.STANDBY;
        }
    }

    private void forwardDetectionToCore(CamDetectionPayload payload) {
        try {
            restClient.post()
                    .uri(trafficCoreUrl + "/api/v1/internal/detection")
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.debug("Could not forward detection to traffic-core-service: {}", e.getMessage());
        }
    }

    private void forwardTelemetryToCore(Esp32CentralPayload payload) {
        try {
            restClient.post()
                    .uri(trafficCoreUrl + "/api/v1/internal/telemetry")
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.debug("Could not forward telemetry to traffic-core-service: {}", e.getMessage());
        }
    }
}
