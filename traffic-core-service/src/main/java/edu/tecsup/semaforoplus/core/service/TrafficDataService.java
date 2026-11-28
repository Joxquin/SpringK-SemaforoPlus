package edu.tecsup.semaforoplus.core.service;

import edu.tecsup.semaforoplus.core.dto.CamDetectionDto;
import edu.tecsup.semaforoplus.core.dto.IncidentRequest;
import edu.tecsup.semaforoplus.core.dto.PublicOverviewDto;
import edu.tecsup.semaforoplus.core.model.IncidentEntity;
import edu.tecsup.semaforoplus.core.model.IntersectionEntity;
import edu.tecsup.semaforoplus.core.model.TrafficCycleEntity;
import edu.tecsup.semaforoplus.core.model.TrafficMeasurementEntity;
import edu.tecsup.semaforoplus.core.repository.IncidentRepository;
import edu.tecsup.semaforoplus.core.repository.IntersectionRepository;
import edu.tecsup.semaforoplus.core.repository.TrafficCycleRepository;
import edu.tecsup.semaforoplus.core.repository.TrafficMeasurementRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.*;

@Service
public class TrafficDataService {
    private final TrafficMeasurementRepository measurementRepository;
    private final TrafficCycleRepository cycleRepository;
    private final IntersectionRepository intersectionRepository;
    private final IncidentRepository incidentRepository;
    private final RestClient restClient;

    @Value("${iot-gateway.url:http://localhost:8081}")
    private String iotGatewayUrl;

    public TrafficDataService(
            TrafficMeasurementRepository measurementRepository,
            TrafficCycleRepository cycleRepository,
            IntersectionRepository intersectionRepository,
            IncidentRepository incidentRepository,
            RestClient restClient
    ) {
        this.measurementRepository = measurementRepository;
        this.cycleRepository = cycleRepository;
        this.intersectionRepository = intersectionRepository;
        this.incidentRepository = incidentRepository;
        this.restClient = restClient;
    }

    public void saveDetection(CamDetectionDto dto) {
        int autos = dto.autos() != null ? dto.autos() : 0;
        int combis = dto.combis() != null ? dto.combis() : 0;
        int emerg = dto.unidadesEmergencia() != null ? dto.unidadesEmergencia() : 0;

        TrafficMeasurementEntity m = new TrafficMeasurementEntity();
        m.setCamId(dto.camId() != null ? dto.camId() : "CAM-01");
        m.setAutos(autos);
        m.setCombis(combis);
        m.setUnidadesEmergencia(emerg);
        m.setTotalVehicles(autos + combis);
        m.setWeightedLoad(autos * 1.0 + combis * 2.2);
        m.setInferenceLatencyMs(dto.inferenceLatencyMs() != null ? dto.inferenceLatencyMs() : 0);
        m.setConfidenceAvg(dto.confidenceAvg() != null ? dto.confidenceAvg() : 0.0);
        m.setTimestamp(Instant.now());
        measurementRepository.save(m);

        if (emerg > 0) {
            incidentRepository.save(new IncidentEntity(
                    "INT-01",
                    "Unidad de emergencia detectada en " + m.getCamId(),
                    "Prioridad semafórica activada automáticamente por visión artificial YOLOv8.",
                    "EMERGENCIA",
                    "CRITICA",
                    "ACTIVA",
                    "YOLOv8-" + m.getCamId()
            ));
        }
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> fetchRealtimeNode() {
        try {
            return restClient.get()
                    .uri(iotGatewayUrl + "/api/v1/realtime/node")
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
        } catch (Exception e) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    public PublicOverviewDto buildPublicOverview() {
        Map<String, Object> node = fetchRealtimeNode();
        if (node == null) {
            return new PublicOverviewDto(
                    false,
                    false,
                    false,
                    false,
                    "Gateway IoT no disponible",
                    "Av. Ejército × Calle Los Arces (Yanahuara)",
                    0,
                    "SIN CONEXIÓN",
                    false,
                    0.0,
                    0.0,
                    0.0,
                    List.of(
                            new PublicOverviewDto.LaneOverview("SEM-01", "Carril Norte", "Av. Ejército", "STANDBY", 0, 0, 0, false),
                            new PublicOverviewDto.LaneOverview("SEM-02", "Carril Este", "Calle Los Arces", "STANDBY", 0, 0, 0, false)
                    ),
                    List.of("Sistema hardware en espera de conexión con ESP32 y cámaras ESP32-CAM."),
                    Instant.now().toString()
            );
        }

        boolean iotConnected = Boolean.TRUE.equals(node.get("iotConnected"));
        boolean emergency = Boolean.TRUE.equals(node.get("activeEmergencyPriority"));
        String offlineMsg = (String) node.get("offlineMessage");

        List<Map<String, Object>> lights = (List<Map<String, Object>>) node.getOrDefault("trafficLights", List.of());
        List<Map<String, Object>> cams = (List<Map<String, Object>>) node.getOrDefault("cameras", List.of());

        boolean espOnline = !lights.isEmpty() && Boolean.TRUE.equals(lights.get(0).get("online"));
        boolean cam1Online = cams.size() > 0 && Boolean.TRUE.equals(cams.get(0).get("online"));
        boolean cam2Online = cams.size() > 1 && Boolean.TRUE.equals(cams.get(1).get("online"));

        List<PublicOverviewDto.LaneOverview> lanes = new ArrayList<>();
        int totalVehicles = 0;

        for (int i = 0; i < 2; i++) {
            Map<String, Object> light = i < lights.size() ? lights.get(i) : Map.of();
            Map<String, Object> cam = i < cams.size() ? cams.get(i) : Map.of();
            Map<String, Object> cls = (Map<String, Object>) cam.getOrDefault("classification", Map.of());

            int vehicles = ((Number) cls.getOrDefault("autos", 0)).intValue()
                    + ((Number) cls.getOrDefault("combis", 0)).intValue();
            boolean camOn = Boolean.TRUE.equals(cam.get("online"));
            boolean lightOn = Boolean.TRUE.equals(light.get("online"));
            int cong = camOn ? Math.min(100, vehicles * 10) : 0;
            totalVehicles += vehicles;

            lanes.add(new PublicOverviewDto.LaneOverview(
                    String.valueOf(light.getOrDefault("id", i == 0 ? "SEM-01" : "SEM-02")),
                    String.valueOf(light.getOrDefault("name", i == 0 ? "Semáforo Norte" : "Semáforo Este")),
                    String.valueOf(light.getOrDefault("avenue", i == 0 ? "Av. Ejército" : "Calle Los Arces")),
                    String.valueOf(light.getOrDefault("currentState", "STANDBY")),
                    ((Number) light.getOrDefault("remainingSeconds", 0)).intValue(),
                    vehicles,
                    cong,
                    lightOn
            ));
        }

        int overallCong = (cam1Online || cam2Online) ? Math.min(100, totalVehicles * 6) : 0;
        double avgWait = (cam1Online || cam2Online) ? Math.round(totalVehicles * 2.1 * 10.0) / 10.0 : 0.0;
        double avgSpeed = (cam1Online || cam2Online) ? Math.max(12.0, Math.round((42.0 - overallCong * 0.25) * 10.0) / 10.0) : 0.0;
        double co2Saved = (cam1Online || cam2Online) ? Math.round(totalVehicles * 0.18 * 10.0) / 10.0 : 0.0;

        String corridorStatus = !iotConnected
                ? "SIN SEÑAL HARDWARE"
                : emergency
                ? "PRIORIDAD EMERGENCIA"
                : overallCong > 70
                ? "CONGESTIÓN ALTA"
                : overallCong > 35
                ? "TRÁFICO MODERADO"
                : "TRÁFICO FLUIDO";

        List<String> alerts = new ArrayList<>();
        if (offlineMsg != null && !offlineMsg.isBlank()) {
            alerts.add(offlineMsg);
        }
        if (emergency) {
            alerts.add("Prioridad de emergencia activa en intersección Av. Ejército × Calle Los Arces.");
        }

        return new PublicOverviewDto(
                iotConnected,
                espOnline,
                cam1Online,
                cam2Online,
                offlineMsg,
                String.valueOf(node.getOrDefault("name", "Av. Ejército × Calle Los Arces (Yanahuara)")),
                overallCong,
                corridorStatus,
                emergency,
                avgWait,
                avgSpeed,
                co2Saved,
                lanes,
                alerts,
                Instant.now().toString()
        );
    }

    public List<IntersectionEntity> getIntersections() {
        return intersectionRepository.findAll();
    }

    public List<IncidentEntity> getIncidents() {
        return incidentRepository.findTop50ByOrderByCreatedAtDesc();
    }

    public IncidentEntity createIncident(IncidentRequest req) {
        return incidentRepository.save(new IncidentEntity(
                req.intersectionId() != null ? req.intersectionId() : "INT-01",
                req.title(),
                req.description(),
                req.type() != null ? req.type() : "CONGESTION",
                req.priority() != null ? req.priority() : "MEDIA",
                "NUEVA",
                "OPERADOR"
        ));
    }

    public IncidentEntity updateIncidentStatus(Long id, String status) {
        IncidentEntity entity = incidentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Incident not found: " + id));
        entity.setStatus(status);
        return incidentRepository.save(entity);
    }

    public List<TrafficMeasurementEntity> getRecentMeasurements(int limit) {
        return measurementRepository.findByOrderByTimestampDesc(PageRequest.of(0, Math.min(limit, 100)));
    }

    public List<TrafficCycleEntity> getRecentCycles(int limit) {
        return cycleRepository.findByOrderByTimestampDesc(PageRequest.of(0, Math.min(limit, 100)));
    }

    public Map<String, Object> getAnalyticsSummary(String camId, int limit) {
        int safeLimit = Math.max(10, Math.min(limit, 500));
        List<TrafficMeasurementEntity> recent = (camId == null || "ALL".equalsIgnoreCase(camId))
                ? measurementRepository.findByOrderByTimestampDesc(PageRequest.of(0, safeLimit))
                : measurementRepository.findByCamIdOrderByTimestampDesc(camId, PageRequest.of(0, safeLimit));

        int totalAutos = recent.stream().mapToInt(TrafficMeasurementEntity::getAutos).sum();
        int totalCombis = recent.stream().mapToInt(TrafficMeasurementEntity::getCombis).sum();
        int totalEmergencias = recent.stream().mapToInt(TrafficMeasurementEntity::getUnidadesEmergencia).sum();
        int totalVehicles = totalAutos + totalCombis;

        double avgLatency = recent.stream().mapToInt(TrafficMeasurementEntity::getInferenceLatencyMs).average().orElse(0.0);
        double avgConfidence = recent.stream().mapToDouble(TrafficMeasurementEntity::getConfidenceAvg).average().orElse(0.0);
        double avgLoad = recent.stream().mapToDouble(TrafficMeasurementEntity::getWeightedLoad).average().orElse(0.0);

        List<TrafficCycleEntity> cycles = cycleRepository.findByOrderByTimestampDesc(PageRequest.of(0, safeLimit));
        double avgGreenSem1 = cycles.stream().mapToInt(TrafficCycleEntity::getSem1GreenSeconds).average().orElse(0.0);
        double avgGreenSem2 = cycles.stream().mapToInt(TrafficCycleEntity::getSem2GreenSeconds).average().orElse(0.0);

        long adaptiveCycles = cycles.stream().filter(c -> "ADAPTATIVO".equalsIgnoreCase(c.getMode())).count();
        long fixedCycles = cycles.stream().filter(c -> "FIJO".equalsIgnoreCase(c.getMode())).count();
        long emergencyCycles = cycles.stream().filter(TrafficCycleEntity::isEmergencyOverride).count();

        List<TrafficMeasurementEntity> chronological = new ArrayList<>(recent);
        Collections.reverse(chronological);

        List<Map<String, Object>> timeline = chronological.stream()
                .map(m -> Map.<String, Object>of(
                        "timestamp", m.getTimestamp().toString(),
                        "camId", m.getCamId(),
                        "totalVehicles", m.getTotalVehicles(),
                        "weightedLoad", Math.round(m.getWeightedLoad() * 10.0) / 10.0,
                        "inferenceLatencyMs", m.getInferenceLatencyMs()
                ))
                .toList();

        Map<String, Object> cam1Stats = buildCamStats("CAM-01", recent);
        Map<String, Object> cam2Stats = buildCamStats("CAM-02", recent);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("samplesCount", recent.size());
        result.put("totalVehicles", totalVehicles);
        result.put("totalAutos", totalAutos);
        result.put("totalCombis", totalCombis);
        result.put("totalEmergencias", totalEmergencias);
        result.put("avgInferenceLatencyMs", Math.round(avgLatency * 10.0) / 10.0);
        result.put("avgConfidence", Math.round(avgConfidence * 1000.0) / 10.0);
        result.put("avgWeightedLoad", Math.round(avgLoad * 10.0) / 10.0);
        result.put("cyclesRecorded", cycleRepository.count());
        result.put("avgGreenSem1Seconds", Math.round(avgGreenSem1 * 10.0) / 10.0);
        result.put("avgGreenSem2Seconds", Math.round(avgGreenSem2 * 10.0) / 10.0);
        result.put("adaptiveCycles", adaptiveCycles);
        result.put("fixedCycles", fixedCycles);
        result.put("emergencyCycles", emergencyCycles);
        result.put("byCamera", List.of(cam1Stats, cam2Stats));
        result.put("timeline", timeline);
        return result;
    }

    private Map<String, Object> buildCamStats(String camId, List<TrafficMeasurementEntity> rows) {
        List<TrafficMeasurementEntity> camRows = rows.stream()
                .filter(r -> camId.equals(r.getCamId()))
                .toList();
        int vehicles = camRows.stream().mapToInt(TrafficMeasurementEntity::getTotalVehicles).sum();
        double avgLoad = camRows.stream().mapToDouble(TrafficMeasurementEntity::getWeightedLoad).average().orElse(0.0);
        double avgLat = camRows.stream().mapToInt(TrafficMeasurementEntity::getInferenceLatencyMs).average().orElse(0.0);
        return Map.of(
                "camId", camId,
                "samples", camRows.size(),
                "totalVehicles", vehicles,
                "avgWeightedLoad", Math.round(avgLoad * 10.0) / 10.0,
                "avgLatencyMs", Math.round(avgLat * 10.0) / 10.0
        );
    }
}
