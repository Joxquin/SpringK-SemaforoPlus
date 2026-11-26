package edu.tecsup.semaforoplus.core.controller;

import edu.tecsup.semaforoplus.core.dto.IncidentRequest;
import edu.tecsup.semaforoplus.core.model.IncidentEntity;
import edu.tecsup.semaforoplus.core.model.IntersectionEntity;
import edu.tecsup.semaforoplus.core.model.TrafficCycleEntity;
import edu.tecsup.semaforoplus.core.model.TrafficMeasurementEntity;
import edu.tecsup.semaforoplus.core.service.AdaptiveTrafficEngineService;
import edu.tecsup.semaforoplus.core.service.TrafficDataService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class TrafficAdminController {
    private final TrafficDataService trafficDataService;
    private final AdaptiveTrafficEngineService engineService;

    public TrafficAdminController(TrafficDataService trafficDataService, AdaptiveTrafficEngineService engineService) {
        this.trafficDataService = trafficDataService;
        this.engineService = engineService;
    }

    @GetMapping("/intersections")
    public ResponseEntity<List<IntersectionEntity>> getIntersections() {
        return ResponseEntity.ok(trafficDataService.getIntersections());
    }

    @GetMapping("/incidents")
    public ResponseEntity<List<IncidentEntity>> getIncidents() {
        return ResponseEntity.ok(trafficDataService.getIncidents());
    }

    @PostMapping("/incidents")
    public ResponseEntity<IncidentEntity> createIncident(@RequestBody IncidentRequest req) {
        return ResponseEntity.ok(trafficDataService.createIncident(req));
    }

    @PatchMapping("/incidents/{id}/status")
    public ResponseEntity<IncidentEntity> updateIncidentStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(trafficDataService.updateIncidentStatus(id, body.getOrDefault("status", "REVISADA")));
    }

    @GetMapping("/traffic/measurements")
    public ResponseEntity<List<TrafficMeasurementEntity>> getMeasurements(@RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(trafficDataService.getRecentMeasurements(limit));
    }

    @GetMapping("/traffic/cycles")
    public ResponseEntity<List<TrafficCycleEntity>> getCycles(@RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(trafficDataService.getRecentCycles(limit));
    }

    @GetMapping("/traffic/analytics")
    public ResponseEntity<Map<String, Object>> getAnalytics() {
        return ResponseEntity.ok(trafficDataService.getAnalyticsSummary());
    }

    @GetMapping("/mode")
    public ResponseEntity<Map<String, String>> getMode() {
        return ResponseEntity.ok(Map.of("mode", engineService.getMode()));
    }

    @PostMapping("/mode")
    public ResponseEntity<Map<String, String>> setMode(@RequestBody Map<String, String> body) {
        engineService.setMode(body.getOrDefault("mode", "ADAPTATIVO"));
        return ResponseEntity.ok(Map.of("mode", engineService.getMode()));
    }
}
