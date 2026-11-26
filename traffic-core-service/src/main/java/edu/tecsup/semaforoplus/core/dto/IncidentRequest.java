package edu.tecsup.semaforoplus.core.dto;

public record IncidentRequest(
        String intersectionId,
        String title,
        String description,
        String type,
        String priority
) {}
