package edu.tecsup.semaforoplus.core.repository;

import edu.tecsup.semaforoplus.core.model.TrafficMeasurementEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TrafficMeasurementRepository extends JpaRepository<TrafficMeasurementEntity, Long> {
    List<TrafficMeasurementEntity> findByOrderByTimestampDesc(Pageable pageable);
    List<TrafficMeasurementEntity> findByCamIdOrderByTimestampDesc(String camId, Pageable pageable);
}
