package com.crm.repository;

import com.crm.model.Call;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface CallRepository extends JpaRepository<Call, Long> {
    List<Call> findByLeadIdOrderByCreatedAtDesc(Long leadId);

    java.util.Optional<Call> findByTelephonyCallId(String telephonyCallId);

    boolean existsByTelephonyCallId(String telephonyCallId);

    List<Call> findByLeadIdOrderByStartedAtAsc(Long leadId);

    @Query("SELECT c FROM Call c LEFT JOIN c.lead l WHERE " +
           "(:userId IS NULL OR c.user.id = :userId) AND " +
           "(:leadId IS NULL OR l.id = :leadId) AND " +
           "(:projectId IS NULL OR l.project.id = :projectId) AND " +
           "(:status IS NULL OR " +
           "  (:status = 'CONNECTED' AND (c.callStatus = 'CONNECTED' OR c.isConnected = true OR c.durationSeconds > 0)) OR " +
           "  (:status <> 'CONNECTED' AND c.callStatus = :status)) AND " +
           "(:outcome IS NULL OR c.businessOutcome = :outcome) AND " +
           "(:startDate IS NULL OR c.createdAt >= :startDate) AND " +
           "(:endDate IS NULL OR c.createdAt <= :endDate)")
    Page<Call> searchCalls(@Param("userId") Long userId,
                           @Param("leadId") Long leadId,
                           @Param("projectId") Long projectId,
                           @Param("status") String status,
                           @Param("outcome") String outcome,
                           @Param("startDate") LocalDateTime startDate,
                           @Param("endDate") LocalDateTime endDate,
                           Pageable pageable);

    long countByLeadId(Long leadId);
    long countByLeadIdAndCallStatus(Long leadId, String callStatus);

    @Query("SELECT COALESCE(SUM(c.durationSeconds), 0) FROM Call c WHERE c.lead.id = :leadId")
    long sumDurationByLeadId(@Param("leadId") Long leadId);

    long countByUserIdAndCreatedAtBetween(Long userId, LocalDateTime start, LocalDateTime end);
    long countByUserIdAndCallStatusAndCreatedAtBetween(Long userId, String callStatus, LocalDateTime start, LocalDateTime end);

    @Query("SELECT COUNT(c) FROM Call c WHERE c.user.id = :userId AND (c.isConnected = true OR c.callStatus = 'CONNECTED' OR c.durationSeconds > 0) AND c.createdAt >= :start AND c.createdAt <= :end")
    long countConnectedCallsForUserToday(@Param("userId") Long userId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT COUNT(c) FROM Call c WHERE (c.isConnected = true OR c.callStatus = 'CONNECTED' OR c.durationSeconds > 0)")
    long countTotalConnectedCalls();

    @Query("SELECT COALESCE(SUM(c.durationSeconds), 0) FROM Call c WHERE c.user.id = :userId")
    long sumDurationByUserId(@Param("userId") Long userId);

    void deleteByUserId(Long userId);

    List<Call> findByClassificationChangedById(Long classificationChangedById);

    long countByCreatedAtBetween(LocalDateTime start, LocalDateTime end);
    long countByCallStatus(String callStatus);

    List<Call> findByUserId(Long userId);
    List<Call> findByUserIdAndCreatedAtBetween(Long userId, LocalDateTime start, LocalDateTime end);
}
