package edu.tecsup.semaforoplus.core.dto;

public record TrafficControlDto(
        String phase,
        String sem1State,
        String sem2State,
        int sem1Remaining,
        int sem2Remaining,
        int sem1GreenAllocated,
        int sem2GreenAllocated,
        String mode,
        boolean emergencyActive,
        String emergencyCamId
) {}
