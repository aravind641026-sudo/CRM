package com.crm.repository;

import com.crm.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByUserIdOrderByCreatedAtDesc(Long userId);
    long countByUserIdAndIsReadFalse(Long userId);
    boolean existsByUserIdAndReferenceIdAndType(Long userId, Long referenceId, String type);
    void deleteByUserId(Long userId);
}
