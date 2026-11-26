package edu.tecsup.semaforoplus.core.controller;

import edu.tecsup.semaforoplus.core.dto.CamDetectionDto;
import edu.tecsup.semaforoplus.core.dto.Esp32TelemetryDto;
import edu.tecsup.semaforoplus.core.service.AdaptiveTrafficEngineService;
import edu.tecsup.semaforoplus.core.service.TrafficDataService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/internal")
public class InternalIngestionController {
    private final TrafficDataService trafficDataService;
    private final AdaptiveTrafficEngineService engineService;

    public InternalIngestionController(TrafficDataService trafficDataService, AdaptiveTrafficEngineService engineService) {
        this.trafficDataService = trafficDataService;
        this.engineService = engineService;
    }

    @PostMapping("/detection")
    public ResponseEntity<Void> ingestDetection(@RequestBody CamDetectionDto dto) {
        trafficDataService.saveDetection(dto);
        engineService.onDetection(dto);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/telemetry")
    public ResponseEntity<Void> ingestTelemetry(@RequestBody Esp32TelemetryDto dto) {
        return ResponseEntity.ok().build();
    }
}
