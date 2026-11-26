package edu.tecsup.semaforoplus.iot.model;

import java.util.List;

public record TrafficNodeStatus(
        String nodeId,
        String name,
        String esp32Ip,
        boolean iotConnected,
        String esp32CentralStatus,
        String offlineMessage,
        boolean activeEmergencyPriority,
        String emergencyCameraId,
        String currentPhase,
        List<TrafficLightStatus> trafficLights,
        List<Esp32CamStatus> cameras,
        SolarBackupStatus solarBackup,
        SafetyLimits safetyLimits,
        String timestamp
) {}
