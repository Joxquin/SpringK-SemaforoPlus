package edu.tecsup.semaforoplus.iot.dto;

public record Esp32CentralPayload(
        String nodeId,
        String nodeCode,
        String ipAddress,
        String sem1State,
        String sem2State,
        Integer sem1Remaining,
        Integer sem2Remaining,
        Integer remainingSeconds,
        Double batteryVoltage,
        Integer batteryPercent,
        Double solarPowerWatts,
        Double autonomyHours,
        String powerSource,
        String firmwareVersion
) {}
