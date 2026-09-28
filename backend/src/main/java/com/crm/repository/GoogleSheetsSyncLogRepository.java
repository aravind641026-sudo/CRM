package com.crm.repository;

import com.crm.model.GoogleSheetsSyncLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface GoogleSheetsSyncLogRepository extends JpaRepository<GoogleSheetsSyncLog, Long> {
    Page<GoogleSheetsSyncLog> findAllByOrderByStartedAtDesc(Pageable pageable);
    Optional<GoogleSheetsSyncLog> findTopByOrderByStartedAtDesc();
    boolean existsByStatus(String status);
    java.util.List<GoogleSheetsSyncLog> findByTriggeredById(Long triggeredById);
    void deleteByTriggeredById(Long triggeredById);
}
