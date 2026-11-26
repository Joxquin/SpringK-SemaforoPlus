package edu.tecsup.semaforoplus.iot.dto;

public record CamDetectionPayload(
        String camId,
        String ipAddress,
        Integer autos,
        Integer combis,
        Integer motos,
        Integer peatones,
        Integer unidadesEmergencia,
        Integer fps,
        Integer inferenceLatencyMs,
        Double confidenceAvg,
        String firmwareVersion
) {}
