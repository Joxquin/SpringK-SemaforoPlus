package edu.tecsup.semaforoplus.iot.model;

public record VehicleClassification(
        int autos,
        int combis,
        int unidadesEmergencia
) {
    public int totalVehicles() {
        return autos + combis;
    }

    public double weightedTrafficLoad() {
        return autos * 1.0 + combis * 2.2;
    }

    public boolean hasEmergencyVehicle() {
        return unidadesEmergencia > 0;
    }

    public static VehicleClassification empty() {
        return new VehicleClassification(0, 0, 0);
    }
}
