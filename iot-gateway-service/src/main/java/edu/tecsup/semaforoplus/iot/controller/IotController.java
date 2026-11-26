package edu.tecsup.semaforoplus.iot.controller;

import edu.tecsup.semaforoplus.iot.dto.CamDetectionPayload;
import edu.tecsup.semaforoplus.iot.dto.Esp32CentralPayload;
import edu.tecsup.semaforoplus.iot.dto.TrafficControlPayload;
import edu.tecsup.semaforoplus.iot.model.TrafficNodeStatus;
import edu.tecsup.semaforoplus.iot.service.HardwareStateService;
import edu.tecsup.semaforoplus.iot.service.MqttService;
import edu.tecsup.semaforoplus.iot.service.UdpVideoService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/iot")
public class IotController {
    private final HardwareStateService hardwareStateService;
    private final UdpVideoService udpVideoService;
    private final MqttService mqttService;

    public IotController(
            HardwareStateService hardwareStateService,
            UdpVideoService udpVideoService,
            MqttService mqttService
    ) {
        this.hardwareStateService = hardwareStateService;
        this.udpVideoService = udpVideoService;
        this.mqttService = mqttService;
    }

    @PostMapping("/esp32/telemetry")
    public ResponseEntity<Map<String, Object>> receiveEsp32Telemetry(@RequestBody Esp32CentralPayload payload) {
        hardwareStateService.updateEsp32Telemetry(payload);
        return ResponseEntity.ok(Map.of("status", "ok", "device", "ESP32-CENTRAL"));
    }

    @GetMapping("/esp32/command")
    public ResponseEntity<Map<String, Object>> getCommandForDisplay() {
        TrafficNodeStatus node = hardwareStateService.getNodeStatus();
        var sem1 = node.trafficLights().get(0);
        var sem2 = node.trafficLights().get(1);
        var cam1 = node.cameras().get(0);
        var cam2 = node.cameras().get(1);
        return ResponseEntity.ok(Map.of(
                "sem1State", sem1.currentState().name(),
                "sem2State", sem2.currentState().name(),
                "sem1Remaining", sem1.remainingSeconds(),
                "sem2Remaining", sem2.remainingSeconds(),
                "emergency", node.activeEmergencyPriority(),
                "cam1Vehicles", cam1.classification().totalVehicles(),
                "cam2Vehicles", cam2.classification().totalVehicles(),
                "iotConnected", node.iotConnected()
        ));
    }

    @PostMapping("/cam/frame")
    public ResponseEntity<Map<String, Object>> uploadFrame(
            @RequestParam(defaultValue = "CAM-01") String camId,
            @RequestBody byte[] jpegBytes
    ) {
        udpVideoService.saveRawFrame(camId, jpegBytes);
        return ResponseEntity.ok(Map.of("status", "ok", "camId", camId, "bytes", jpegBytes.length));
    }

    @PostMapping("/cam/detection")
    public ResponseEntity<Map<String, Object>> receiveCamDetection(@RequestBody CamDetectionPayload payload) {
        hardwareStateService.updateCamDetection(payload);
        return ResponseEntity.ok(Map.of("status", "ok", "camId", payload.camId()));
    }

    @PostMapping("/traffic-lights/control")
    public ResponseEntity<Map<String, Object>> applyTrafficControl(@RequestBody TrafficControlPayload payload) {
        hardwareStateService.applyTrafficControl(payload);
        mqttService.publishTrafficCommand(payload);
        return ResponseEntity.ok(Map.of("status", "applied", "phase", payload.phase()));
    }

    @PostMapping("/disconnect-all")
    public ResponseEntity<Map<String, Object>> disconnectAll() {
        hardwareStateService.disconnectAll();
        return ResponseEntity.ok(Map.of("status", "disconnected"));
    }
}
