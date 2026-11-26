package edu.tecsup.semaforoplus.core.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "traffic_cycles", indexes = {
        @Index(name = "idx_tc_timestamp", columnList = "timestamp")
})
public class TrafficCycleEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 32)
    private String intersectionId;

    @Column(nullable = false, length = 40)
    private String phase;

    @Column(nullable = false, length = 16)
    private String sem1State;

    @Column(nullable = false, length = 16)
    private String sem2State;

    private int sem1GreenSeconds;
    private int sem2GreenSeconds;
    private int cam1Vehicles;
    private int cam2Vehicles;
    private boolean emergencyOverride;

    @Column(nullable = false, length = 24)
    private String mode;

    @Column(nullable = false)
    private Instant timestamp;

    public TrafficCycleEntity() {}

    public Long getId() { return id; }
    public String getIntersectionId() { return intersectionId; }
    public void setIntersectionId(String intersectionId) { this.intersectionId = intersectionId; }
    public String getPhase() { return phase; }
    public void setPhase(String phase) { this.phase = phase; }
    public String getSem1State() { return sem1State; }
    public void setSem1State(String sem1State) { this.sem1State = sem1State; }
    public String getSem2State() { return sem2State; }
    public void setSem2State(String sem2State) { this.sem2State = sem2State; }
    public int getSem1GreenSeconds() { return sem1GreenSeconds; }
    public void setSem1GreenSeconds(int sem1GreenSeconds) { this.sem1GreenSeconds = sem1GreenSeconds; }
    public int getSem2GreenSeconds() { return sem2GreenSeconds; }
    public void setSem2GreenSeconds(int sem2GreenSeconds) { this.sem2GreenSeconds = sem2GreenSeconds; }
    public int getCam1Vehicles() { return cam1Vehicles; }
    public void setCam1Vehicles(int cam1Vehicles) { this.cam1Vehicles = cam1Vehicles; }
    public int getCam2Vehicles() { return cam2Vehicles; }
    public void setCam2Vehicles(int cam2Vehicles) { this.cam2Vehicles = cam2Vehicles; }
    public boolean isEmergencyOverride() { return emergencyOverride; }
    public void setEmergencyOverride(boolean emergencyOverride) { this.emergencyOverride = emergencyOverride; }
    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }
    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }
}
