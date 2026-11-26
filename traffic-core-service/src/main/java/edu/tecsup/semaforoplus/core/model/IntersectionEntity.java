package edu.tecsup.semaforoplus.core.model;

import jakarta.persistence.*;

@Entity
@Table(name = "intersections")
public class IntersectionEntity {
    @Id
    @Column(length = 32)
    private String id;

    @Column(nullable = false, length = 160)
    private String name;

    @Column(nullable = false, length = 100)
    private String zone;

    @Column(nullable = false, length = 32)
    private String mode;

    @Column(nullable = false, length = 64)
    private String status;

    @Column(nullable = false)
    private double latitude;

    @Column(nullable = false)
    private double longitude;

    public IntersectionEntity() {}

    public IntersectionEntity(String id, String name, String zone, String mode, String status, double latitude, double longitude) {
        this.id = id;
        this.name = name;
        this.zone = zone;
        this.mode = mode;
        this.status = status;
        this.latitude = latitude;
        this.longitude = longitude;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getZone() { return zone; }
    public void setZone(String zone) { this.zone = zone; }
    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public double getLatitude() { return latitude; }
    public void setLatitude(double latitude) { this.latitude = latitude; }
    public double getLongitude() { return longitude; }
    public void setLongitude(double longitude) { this.longitude = longitude; }
}
