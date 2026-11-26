package edu.tecsup.semaforoplus.core.service;

import edu.tecsup.semaforoplus.core.dto.CamDetectionDto;
import edu.tecsup.semaforoplus.core.dto.TrafficControlDto;
import edu.tecsup.semaforoplus.core.model.TrafficCycleEntity;
import edu.tecsup.semaforoplus.core.repository.TrafficCycleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Instant;

@Service
public class AdaptiveTrafficEngineService {
    private static final Logger log = LoggerFactory.getLogger(AdaptiveTrafficEngineService.class);
    private static final int MIN_GREEN = 15;
    private static final int MAX_GREEN = 60;
    private static final int YELLOW_SECONDS = 3;
    private static final int ALL_RED_SECONDS = 2;
    private static final int EMERGENCY_GREEN = 45;

    private final TrafficCycleRepository cycleRepository;
    private final RestClient restClient;

    @Value("${iot-gateway.url:http://localhost:8081}")
    private String iotGatewayUrl;

    private volatile String mode = "ADAPTATIVO";
    private volatile String currentPhase = "FASE_1_VERDE";
    private volatile int phaseRemaining = 25;
    private volatile int sem1GreenAllocated = 25;
    private volatile int sem2GreenAllocated = 20;

    private volatile int cam1Vehicles = 0;
    private volatile int cam2Vehicles = 0;
    private volatile double cam1Load = 0.0;
    private volatile double cam2Load = 0.0;

    private volatile boolean emergencyActive = false;
    private volatile String emergencyCamId = null;

    public AdaptiveTrafficEngineService(TrafficCycleRepository cycleRepository, RestClient restClient) {
        this.cycleRepository = cycleRepository;
        this.restClient = restClient;
    }

    public void onDetection(CamDetectionDto dto) {
        int autos = dto.autos() != null ? dto.autos() : 0;
        int combis = dto.combis() != null ? dto.combis() : 0;
        int motos = dto.motos() != null ? dto.motos() : 0;
        int emerg = dto.unidadesEmergencia() != null ? dto.unidadesEmergencia() : 0;
        int total = autos + combis + motos;
        double load = autos * 1.0 + combis * 2.2 + motos * 0.5;

        if ("CAM-01".equals(dto.camId())) {
            cam1Vehicles = total;
            cam1Load = load;
        } else if ("CAM-02".equals(dto.camId())) {
            cam2Vehicles = total;
            cam2Load = load;
        }

        if (emerg > 0 && !emergencyActive) {
            triggerEmergency(dto.camId());
        }
    }

    public synchronized void triggerEmergency(String camId) {
        emergencyActive = true;
        emergencyCamId = camId;
        if ("CAM-01".equals(camId)) {
            currentPhase = "FASE_1_VERDE";
            phaseRemaining = EMERGENCY_GREEN;
            sem1GreenAllocated = EMERGENCY_GREEN;
        } else {
            currentPhase = "FASE_2_VERDE";
            phaseRemaining = EMERGENCY_GREEN;
            sem2GreenAllocated = EMERGENCY_GREEN;
        }
        saveCycle();
    }

    public synchronized void resetEmergency() {
        emergencyActive = false;
        emergencyCamId = null;
    }

    public void setMode(String newMode) {
        if ("ADAPTATIVO".equalsIgnoreCase(newMode) || "FIJO".equalsIgnoreCase(newMode)) {
            this.mode = newMode.toUpperCase();
        }
    }

    public String getMode() {
        return mode;
    }

    @Scheduled(fixedRate = 1000)
    public synchronized void tick() {
        if (phaseRemaining > 0) {
            phaseRemaining--;
        }
        if (phaseRemaining <= 0) {
            advancePhase();
        }

        TrafficControlDto control = buildControlPayload();
        pushControlToGateway(control);
    }

    private void advancePhase() {
        switch (currentPhase) {
            case "FASE_1_VERDE" -> {
                currentPhase = "FASE_1_AMBAR";
                phaseRemaining = YELLOW_SECONDS;
            }
            case "FASE_1_AMBAR" -> {
                currentPhase = "SEGURIDAD_TODO_ROJO_1";
                phaseRemaining = ALL_RED_SECONDS;
            }
            case "SEGURIDAD_TODO_ROJO_1" -> {
                sem2GreenAllocated = calculateGreenTime(cam2Load);
                currentPhase = "FASE_2_VERDE";
                phaseRemaining = sem2GreenAllocated;
                emergencyActive = false;
                emergencyCamId = null;
                saveCycle();
            }
            case "FASE_2_VERDE" -> {
                currentPhase = "FASE_2_AMBAR";
                phaseRemaining = YELLOW_SECONDS;
            }
            case "FASE_2_AMBAR" -> {
                currentPhase = "SEGURIDAD_TODO_ROJO_2";
                phaseRemaining = ALL_RED_SECONDS;
            }
            default -> {
                sem1GreenAllocated = calculateGreenTime(cam1Load);
                currentPhase = "FASE_1_VERDE";
                phaseRemaining = sem1GreenAllocated;
                emergencyActive = false;
                emergencyCamId = null;
                saveCycle();
            }
        }
    }

    private int calculateGreenTime(double weightedLoad) {
        if ("FIJO".equals(mode)) {
            return 25;
        }
        int computed = (int) Math.round(MIN_GREEN + weightedLoad * 2.5);
        return Math.max(MIN_GREEN, Math.min(MAX_GREEN, computed));
    }

    private TrafficControlDto buildControlPayload() {
        String s1 = "RED";
        String s2 = "RED";
        int r1 = phaseRemaining + YELLOW_SECONDS + ALL_RED_SECONDS;
        int r2 = phaseRemaining + YELLOW_SECONDS + ALL_RED_SECONDS;

        switch (currentPhase) {
            case "FASE_1_VERDE" -> {
                s1 = "GREEN";
                s2 = "RED";
                r1 = phaseRemaining;
                r2 = phaseRemaining + YELLOW_SECONDS + ALL_RED_SECONDS;
            }
            case "FASE_1_AMBAR" -> {
                s1 = "YELLOW";
                s2 = "RED";
                r1 = phaseRemaining;
                r2 = phaseRemaining + ALL_RED_SECONDS;
            }
            case "SEGURIDAD_TODO_ROJO_1" -> {
                s1 = "RED";
                s2 = "RED";
                r1 = phaseRemaining + sem2GreenAllocated + YELLOW_SECONDS + ALL_RED_SECONDS;
                r2 = phaseRemaining;
            }
            case "FASE_2_VERDE" -> {
                s1 = "RED";
                s2 = "GREEN";
                r1 = phaseRemaining + YELLOW_SECONDS + ALL_RED_SECONDS;
                r2 = phaseRemaining;
            }
            case "FASE_2_AMBAR" -> {
                s1 = "RED";
                s2 = "YELLOW";
                r1 = phaseRemaining + ALL_RED_SECONDS;
                r2 = phaseRemaining;
            }
            case "SEGURIDAD_TODO_ROJO_2" -> {
                s1 = "RED";
                s2 = "RED";
                r1 = phaseRemaining;
                r2 = phaseRemaining + sem1GreenAllocated + YELLOW_SECONDS + ALL_RED_SECONDS;
            }
        }

        return new TrafficControlDto(
                currentPhase,
                s1,
                s2,
                r1,
                r2,
                sem1GreenAllocated,
                sem2GreenAllocated,
                emergencyActive ? "EMERGENCIA" : mode,
                emergencyActive,
                emergencyCamId
        );
    }

    private void saveCycle() {
        try {
            TrafficControlDto dto = buildControlPayload();
            TrafficCycleEntity entity = new TrafficCycleEntity();
            entity.setIntersectionId("INT-01");
            entity.setPhase(dto.phase());
            entity.setSem1State(dto.sem1State());
            entity.setSem2State(dto.sem2State());
            entity.setSem1GreenSeconds(dto.sem1GreenAllocated());
            entity.setSem2GreenSeconds(dto.sem2GreenAllocated());
            entity.setCam1Vehicles(cam1Vehicles);
            entity.setCam2Vehicles(cam2Vehicles);
            entity.setEmergencyOverride(dto.emergencyActive());
            entity.setMode(dto.mode());
            entity.setTimestamp(Instant.now());
            cycleRepository.save(entity);
        } catch (Exception e) {
            log.debug("Failed to persist cycle: {}", e.getMessage());
        }
    }

    private void pushControlToGateway(TrafficControlDto payload) {
        try {
            restClient.post()
                    .uri(iotGatewayUrl + "/api/v1/iot/traffic-lights/control")
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.debug("iot-gateway-service unavailable: {}", e.getMessage());
        }
    }
}
