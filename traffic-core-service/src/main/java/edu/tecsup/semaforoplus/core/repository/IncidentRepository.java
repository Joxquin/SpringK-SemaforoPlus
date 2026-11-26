package edu.tecsup.semaforoplus.core.repository;

import edu.tecsup.semaforoplus.core.model.IncidentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface IncidentRepository extends JpaRepository<IncidentEntity, Long> {
    List<IncidentEntity> findTop50ByOrderByCreatedAtDesc();
}
