package edu.tecsup.semaforoplus.iot.model;

public record SolarBackupStatus(
        boolean online,
        double batteryVoltage,
        int batteryPercent,
        double solarPowerWatts,
        double autonomyHours,
        String powerSource,
        String statusLabel
) {}
