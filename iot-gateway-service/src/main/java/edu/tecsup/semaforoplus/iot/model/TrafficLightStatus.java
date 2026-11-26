package edu.tecsup.semaforoplus.iot.model;

public record TrafficLightStatus(
        String id,
        String name,
        String avenue,
        LightState currentState,
        PedestrianState pedestrianState,
        int remainingSeconds,
        int greenAllocatedSeconds,
        String mode,
        boolean online,
        String lastUpdated
) {}
