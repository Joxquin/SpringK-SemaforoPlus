package edu.tecsup.semaforoplus.core.repository;

import edu.tecsup.semaforoplus.core.model.IntersectionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IntersectionRepository extends JpaRepository<IntersectionEntity, String> {
}
