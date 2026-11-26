package edu.tecsup.semaforoplus.core.controller;

import edu.tecsup.semaforoplus.core.dto.PublicOverviewDto;
import edu.tecsup.semaforoplus.core.service.TrafficDataService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/public")
public class PublicTrafficController {
    private final TrafficDataService trafficDataService;

    public PublicTrafficController(TrafficDataService trafficDataService) {
        this.trafficDataService = trafficDataService;
    }

    @GetMapping("/overview")
    public ResponseEntity<PublicOverviewDto> getOverview() {
        return ResponseEntity.ok(trafficDataService.buildPublicOverview());
    }

    @GetMapping("/hourly-trend")
    public ResponseEntity<List<Map<String, Object>>> getHourlyTrend() {
        var measurements = trafficDataService.getRecentMeasurements(24);
        List<Map<String, Object>> trend = measurements.stream()
                .map(m -> Map.<String, Object>of(
                        "timestamp", m.getTimestamp().toString(),
                        "camId", m.getCamId(),
                        "totalVehicles", m.getTotalVehicles(),
                        "weightedLoad", m.getWeightedLoad()
                ))
                .toList();
        return ResponseEntity.ok(trend);
    }
}
