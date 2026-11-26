package edu.tecsup.semaforoplus.core.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "incidents")
public class IncidentEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 32)
    private String intersectionId;

    @Column(nullable = false, length = 160)
    private String title;

    @Column(nullable = false, length = 500)
    private String description;

    @Column(nullable = false, length = 40)
    private String type;

    @Column(nullable = false, length = 24)
    private String priority;

    @Column(nullable = false, length = 24)
    private String status;

    @Column(nullable = false, length = 64)
    private String source;

    @Column(nullable = false)
    private Instant createdAt;

    public IncidentEntity() {}

    public IncidentEntity(String intersectionId, String title, String description, String type, String priority, String status, String source) {
        this.intersectionId = intersectionId;
        this.title = title;
        this.description = description;
        this.type = type;
        this.priority = priority;
        this.status = status;
        this.source = source;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public String getIntersectionId() { return intersectionId; }
    public void setIntersectionId(String intersectionId) { this.intersectionId = intersectionId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
