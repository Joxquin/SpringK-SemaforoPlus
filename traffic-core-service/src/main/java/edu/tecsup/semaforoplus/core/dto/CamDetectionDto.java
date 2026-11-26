package edu.tecsup.semaforoplus.core.dto;

public record CamDetectionDto(
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
