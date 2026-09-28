package com.crm.repository;

import com.crm.model.AdminAccessRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AdminAccessRequestRepository extends JpaRepository<AdminAccessRequest, Long> {
    Optional<AdminAccessRequest> findTopByUserIdOrderByRequestedAtDesc(Long userId);
    boolean existsByUserIdAndStatus(Long userId, String status);
    List<AdminAccessRequest> findByStatusOrderByRequestedAtDesc(String status);
    List<AdminAccessRequest> findByReviewedById(Long reviewedById);
    void deleteByUserId(Long userId);
}
