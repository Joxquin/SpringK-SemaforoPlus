package edu.tecsup.semaforoplus.core.dto;

public record Esp32TelemetryDto(
        String nodeId,
        String ipAddress,
        String sem1State,
        String sem2State,
        Integer sem1Remaining,
        Integer sem2Remaining,
        Double batteryVoltage,
        Integer batteryPercent,
        Double solarPowerWatts,
        Double autonomyHours,
        String powerSource,
        String firmwareVersion
) {}
