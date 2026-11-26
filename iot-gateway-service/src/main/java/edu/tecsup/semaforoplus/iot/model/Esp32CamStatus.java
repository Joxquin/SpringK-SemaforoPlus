package edu.tecsup.semaforoplus.iot.model;

public record Esp32CamStatus(
        String id,
        String name,
        String avenue,
        String ipAddress,
        boolean online,
        String status,
        int fps,
        int inferenceLatencyMs,
        double confidenceAvg,
        VehicleClassification classification,
        String lastFrameAt
) {}
