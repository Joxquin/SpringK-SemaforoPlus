package edu.tecsup.semaforoplus.core.repository;

import edu.tecsup.semaforoplus.core.model.TrafficCycleEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TrafficCycleRepository extends JpaRepository<TrafficCycleEntity, Long> {
    List<TrafficCycleEntity> findByOrderByTimestampDesc(Pageable pageable);
}
