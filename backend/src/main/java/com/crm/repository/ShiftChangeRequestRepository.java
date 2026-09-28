package com.crm.repository;

import com.crm.model.ShiftChangeRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShiftChangeRequestRepository extends JpaRepository<ShiftChangeRequest, Long> {

    List<ShiftChangeRequest> findByUserIdOrderByRequestedAtDesc(Long userId);

    List<ShiftChangeRequest> findAllByOrderByRequestedAtDesc();

    List<ShiftChangeRequest> findByStatusOrderByRequestedAtDesc(String status);

    boolean existsByUserIdAndStatus(Long userId, String status);

    Optional<ShiftChangeRequest> findFirstByUserIdAndStatusOrderByRequestedAtDesc(Long userId, String status);

    List<ShiftChangeRequest> findByReviewedById(Long reviewedById);

    void deleteByUserId(Long userId);
}
