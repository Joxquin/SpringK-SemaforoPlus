package edu.tecsup.semaforoplus.core.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "traffic_measurements", indexes = {
        @Index(name = "idx_tm_timestamp", columnList = "timestamp"),
        @Index(name = "idx_tm_cam_id", columnList = "camId")
})
public class TrafficMeasurementEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 16)
    private String camId;

    private int autos;
    private int combis;
    private int unidadesEmergencia;
    private int totalVehicles;
    private double weightedLoad;
    private int inferenceLatencyMs;
    private double confidenceAvg;

    @Column(nullable = false)
    private Instant timestamp;

    public TrafficMeasurementEntity() {}

    public Long getId() { return id; }
    public String getCamId() { return camId; }
    public void setCamId(String camId) { this.camId = camId; }
    public int getAutos() { return autos; }
    public void setAutos(int autos) { this.autos = autos; }
    public int getCombis() { return combis; }
    public void setCombis(int combis) { this.combis = combis; }
    public int getUnidadesEmergencia() { return unidadesEmergencia; }
    public void setUnidadesEmergencia(int unidadesEmergencia) { this.unidadesEmergencia = unidadesEmergencia; }
    public int getTotalVehicles() { return totalVehicles; }
    public void setTotalVehicles(int totalVehicles) { this.totalVehicles = totalVehicles; }
    public double getWeightedLoad() { return weightedLoad; }
    public void setWeightedLoad(double weightedLoad) { this.weightedLoad = weightedLoad; }
    public int getInferenceLatencyMs() { return inferenceLatencyMs; }
    public void setInferenceLatencyMs(int inferenceLatencyMs) { this.inferenceLatencyMs = inferenceLatencyMs; }
    public double getConfidenceAvg() { return confidenceAvg; }
    public void setConfidenceAvg(double confidenceAvg) { this.confidenceAvg = confidenceAvg; }
    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }
}
