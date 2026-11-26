package edu.tecsup.semaforoplus.iot.model;

public record SafetyLimits(
        int minGreenSeconds,
        int maxGreenSeconds,
        int yellowSeconds,
        int allRedSeconds,
        int pedestrianClearanceSeconds
) {}
