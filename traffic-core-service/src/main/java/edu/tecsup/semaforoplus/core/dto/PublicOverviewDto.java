package edu.tecsup.semaforoplus.core.dto;

import java.util.List;

public record PublicOverviewDto(
        boolean iotConnected,
        boolean esp32Online,
        boolean cam1Online,
        boolean cam2Online,
        String offlineMessage,
        String intersectionName,
        int overallCongestionPercent,
        String corridorStatus,
        boolean emergencyActive,
        double averageWaitSeconds,
        double averageSpeedKmh,
        double co2SavedKg,
        List<LaneOverview> lanes,
        List<String> alerts,
        String timestamp
) {
    public record LaneOverview(
            String id,
            String name,
            String avenue,
            String lightState,
            int remainingSeconds,
            int vehicleCount,
            int congestionPercent,
            boolean online
    ) {}
}
