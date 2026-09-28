package com.crm.service.impl;

import com.crm.dto.request.CallCreateRequest;
import com.crm.dto.request.FollowUpCreateRequest;
import com.crm.dto.response.CallResponse;
import com.crm.dto.response.CallSummaryStats;
import com.crm.exception.ForbiddenException;
import com.crm.exception.ResourceNotFoundException;
import com.crm.mapper.CallMapper;
import com.crm.model.Call;
import com.crm.model.Lead;
import com.crm.model.User;
import com.crm.repository.CallRepository;
import com.crm.repository.LeadRepository;
import com.crm.repository.UserRepository;
import com.crm.service.AuditService;
import com.crm.service.CallService;
import com.crm.service.FollowUpService;
import com.crm.service.LeadAssignmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CallServiceImpl implements CallService {

    private final CallRepository callRepository;
    private final LeadRepository leadRepository;
    private final UserRepository userRepository;
    private final LeadAssignmentService leadAssignmentService;
    private final FollowUpService followUpService;
    private final com.crm.repository.FollowUpRepository followUpRepository;
    private final CallMapper callMapper;
    private final AuditService auditService;

    @Override
    @Transactional
    public CallResponse logCall(CallCreateRequest request, Long userId, boolean isAdmin) {
        Lead lead = null;
        String rawPhone = request.getPhoneNumber();
        if (request.getLeadId() != null) {
            Lead cand = leadRepository.findById(request.getLeadId()).orElse(null);
            if (cand != null && (isAdmin || leadAssignmentService.isUserAllowedToAccessLead(cand.getId(), userId, isAdmin))) {
                lead = cand;
                rawPhone = lead.getPhone();
            }
        } else if (rawPhone != null && !rawPhone.isBlank()) {
            lead = findAssignedLeadForUser(rawPhone, userId, isAdmin);
        }

        String cleanPhone = rawPhone != null ? rawPhone.replaceAll("[^0-9+]", "") : (lead != null ? lead.getPhone() : null);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        int duration = request.getDurationSeconds() != null ? Math.max(0, request.getDurationSeconds()) : 0;
        LocalDateTime started = request.getStartedAt() != null ? request.getStartedAt() : LocalDateTime.now().minusSeconds(duration);
        LocalDateTime ended = request.getEndedAt() != null ? request.getEndedAt() : LocalDateTime.now();

        boolean isConnected = false;
        if (request.getIsConnected() != null) {
            isConnected = request.getIsConnected() && duration > 0;
        } else if (request.getCallStatus() != null) {
            isConnected = com.crm.util.CallStatusCalculator.isConnectedResult(request.getCallStatus()) && duration > 0;
        } else {
            isConnected = duration > 0;
        }

        String status = com.crm.util.CallStatusCalculator.calculateStatus(isConnected, duration);

        Call call = Call.builder()
                .lead(lead)
                .user(user)
                .phoneNumber(lead != null ? lead.getPhone() : cleanPhone)
                .isConnected(isConnected)
                .callDirection(request.getCallDirection() != null ? request.getCallDirection() : "OUTBOUND")
                .startedAt(started)
                .endedAt(ended)
                .durationSeconds(duration)
                .callStatus(status)
                .automaticClassification(status)
                .finalClassification(status)
                .businessOutcome(status)
                .notes(request.getNotes())
                .build();

        Call saved = callRepository.save(call);

        // Update lead outcome and status if associated with lead
        if (lead != null) {
            lead.setBusinessOutcome(status);
            lead.setLastCallStatus(status);
            lead.setLastCallDuration(duration);
            lead.setLastContactedAt(ended);

            if (isConnected && "NEW".equalsIgnoreCase(lead.getStatus())) {
                lead.setStatus("CONTACTED");
            }
            leadRepository.save(lead);

            // Optional immediate follow-up creation
            if (request.isCreateFollowUp() && request.getFollowUpTime() != null) {
                FollowUpCreateRequest fuReq = new FollowUpCreateRequest(lead.getId(), request.getFollowUpTime(), request.getFollowUpNotes());
                followUpService.createFollowUp(fuReq, userId);
            }
        }

        auditService.logAction(userId, "Call", saved.getId(), "LOG_CALL", null,
                "Status: " + status + ", Duration: " + duration + "s, Lead: " + (lead != null ? lead.getName() : "None"));

        return callMapper.toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public CallSummaryStats getCallSummaryStats(Long leadId) {
        long totalCalls = callRepository.countByLeadId(leadId);
        long connectedCalls = callRepository.countByLeadIdAndCallStatus(leadId, "CONNECTED");
        long noAnswerCalls = callRepository.countByLeadIdAndCallStatus(leadId, "NO_ANSWER");
        long busyCalls = callRepository.countByLeadIdAndCallStatus(leadId, "BUSY");
        long missedCalls = callRepository.countByLeadIdAndCallStatus(leadId, "MISSED");
        long totalDurationSeconds = callRepository.sumDurationByLeadId(leadId);

        List<Call> calls = callRepository.findByLeadIdOrderByCreatedAtDesc(leadId);
        Call latest = calls.isEmpty() ? null : calls.get(0);

        return CallSummaryStats.builder()
                .totalCalls(totalCalls)
                .connectedCalls(connectedCalls)
                .noAnswerCalls(noAnswerCalls)
                .busyCalls(busyCalls)
                .missedCalls(missedCalls)
                .totalDurationSeconds(totalDurationSeconds)
                .lastCallDate(latest != null ? latest.getCreatedAt() : null)
                .lastCallBy(latest != null && latest.getUser() != null ? latest.getUser().getName() : null)
                .lastCallStatus(latest != null ? latest.getCallStatus() : null)
                .lastBusinessOutcome(latest != null ? latest.getBusinessOutcome() : null)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Call> getCallsByLead(Long leadId) {
        if (!leadRepository.existsById(leadId)) {
            throw new ResourceNotFoundException("Lead not found with id: " + leadId);
        }
        return callRepository.findByLeadIdOrderByCreatedAtDesc(leadId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Call> getCallsByLead(Long leadId, Long userId, boolean isAdmin) {
        if (!leadRepository.existsById(leadId)) {
            throw new ResourceNotFoundException("Lead not found with id: " + leadId);
        }
        if (!leadAssignmentService.isUserAllowedToAccessLead(leadId, userId, isAdmin)) {
            throw new ForbiddenException("Access denied: You are not authorized to view call history for this lead");
        }
        return callRepository.findByLeadIdOrderByCreatedAtDesc(leadId);
    }

    @Override
    @Transactional(readOnly = true)
    public CallSummaryStats getCallSummaryStats(Long leadId, Long userId, boolean isAdmin) {
        if (!leadRepository.existsById(leadId)) {
            throw new ResourceNotFoundException("Lead not found with id: " + leadId);
        }
        if (!leadAssignmentService.isUserAllowedToAccessLead(leadId, userId, isAdmin)) {
            throw new ForbiddenException("Access denied: You are not authorized to view call stats for this lead");
        }
        return getCallSummaryStats(leadId);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CallResponse> searchCalls(Long userId, Long leadId, Long projectId, String status, String outcome,
                                          LocalDateTime startDate, LocalDateTime endDate, Pageable pageable) {
        return callRepository.searchCalls(userId, leadId, projectId, status, outcome, startDate, endDate, pageable)
                .map(callMapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public com.crm.dto.response.CallAnalyticsResponse getCallAnalytics(Long userId, LocalDateTime startDate, LocalDateTime endDate) {
        LocalDateTime start = startDate != null ? startDate : LocalDateTime.now().minusDays(7);
        LocalDateTime end = endDate != null ? endDate : LocalDateTime.now();

        List<Call> calls = callRepository.findByUserIdAndCreatedAtBetween(userId, start, end);

        long totalCalls = calls.size();
        long uniqueCalls = calls.stream()
                .filter(c -> c.getDurationSeconds() != null && c.getDurationSeconds() > 1)
                .map(c -> c.getLead() != null ? c.getLead().getId() : null)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .count();

        // Duration classification matching target business rules
        long notAttended = calls.stream()
                .filter(c -> "MISSED".equalsIgnoreCase(c.getCallStatus()) || "NOT_ATTENDED".equalsIgnoreCase(c.getCallStatus()) || !Boolean.TRUE.equals(c.getIsConnected()) || (c.getDurationSeconds() != null && c.getDurationSeconds() == 0))
                .count();
        long junkCalls = calls.stream()
                .filter(c -> "JUNK".equalsIgnoreCase(c.getCallStatus()) || (Boolean.TRUE.equals(c.getIsConnected()) && c.getDurationSeconds() != null && c.getDurationSeconds() > 0 && c.getDurationSeconds() < 30))
                .count();
        long shortCalls = junkCalls;
        long acceptableCalls = calls.stream()
                .filter(c -> "CONNECTED".equalsIgnoreCase(c.getCallStatus()) || "ACCEPTANCE".equalsIgnoreCase(c.getCallStatus()) || (Boolean.TRUE.equals(c.getIsConnected()) && c.getDurationSeconds() != null && c.getDurationSeconds() >= 30 && c.getDurationSeconds() <= 300))
                .count();
        long prospectCalls = calls.stream()
                .filter(c -> "PROSPECT".equalsIgnoreCase(c.getCallStatus()) || (Boolean.TRUE.equals(c.getIsConnected()) && c.getDurationSeconds() != null && c.getDurationSeconds() > 300))
                .count();
        long freshCalls = calls.stream()
                .filter(c -> c.getLead() != null && (c.getLead().getTotalCallCount() == null || c.getLead().getTotalCallCount() <= 1))
                .map(c -> c.getLead().getId())
                .distinct()
                .count();

        // System Breakdown (Section 9)
        long inboundCalls = calls.stream()
                .filter(c -> "INBOUND".equalsIgnoreCase(c.getCallDirection()))
                .count();
        long outboundCalls = calls.stream()
                .filter(c -> c.getCallDirection() == null || "OUTBOUND".equalsIgnoreCase(c.getCallDirection()))
                .count();
        long missedCalls = calls.stream()
                .filter(c -> "MISSED".equalsIgnoreCase(c.getCallStatus()) || "NO_ANSWER".equalsIgnoreCase(c.getCallStatus()))
                .count();
        long connectedCalls = calls.stream()
                .filter(c -> "CONNECTED".equalsIgnoreCase(c.getCallStatus()) && c.getDurationSeconds() != null && c.getDurationSeconds() > 0)
                .count();
        long totalTalkTimeSeconds = calls.stream()
                .mapToLong(c -> c.getDurationSeconds() != null ? c.getDurationSeconds() : 0)
                .sum();
        long averageDurationSeconds = connectedCalls > 0 ? (totalTalkTimeSeconds / connectedCalls) : 0;
        long todayCalls = calls.stream()
                .filter(c -> c.getCreatedAt() != null && c.getCreatedAt().toLocalDate().isEqual(java.time.LocalDate.now()))
                .count();

        long upcomingFollowUps = followUpRepository.countByUserIdAndStatusAndScheduledTimeGreaterThanEqual(userId, "PENDING", LocalDateTime.now());
        long missedFollowUps = followUpRepository.countByUserIdAndStatusAndScheduledTimeLessThan(userId, "PENDING", LocalDateTime.now());

        return com.crm.dto.response.CallAnalyticsResponse.builder()
                .startDate(start)
                .endDate(end)
                .totalCalls(totalCalls)
                .uniqueCalls(uniqueCalls)
                .notAttendedCalls(notAttended)
                .freshCalls(freshCalls)
                .prospectCalls(prospectCalls)
                .junkCalls(junkCalls)
                .acceptableCalls(acceptableCalls)
                .inboundCalls(inboundCalls)
                .outboundCalls(outboundCalls)
                .missedCalls(missedCalls)
                .shortCalls(shortCalls)
                .totalTalkTimeSeconds(totalTalkTimeSeconds)
                .averageDurationSeconds(averageDurationSeconds)
                .connectedCalls(connectedCalls)
                .todayCalls(todayCalls)
                .upcomingFollowUps(upcomingFollowUps)
                .missedFollowUps(missedFollowUps)
                .build();
    }

    private Lead findAssignedLeadForUser(String rawPhone, Long userId, boolean isAdmin) {
        if (rawPhone == null || rawPhone.isBlank()) return null;
        String digitsOnly = rawPhone.replaceAll("[^0-9]", "");
        if (digitsOnly.isBlank()) return null;
        String last10 = digitsOnly.length() >= 10 ? digitsOnly.substring(digitsOnly.length() - 10) : digitsOnly;

        List<Lead> candidateLeads;
        if (isAdmin) {
            candidateLeads = leadRepository.findAll();
        } else {
            candidateLeads = leadRepository.findAllAssignedToUser(userId);
        }

        for (Lead l : candidateLeads) {
            if (l.getPhone() == null) continue;
            String leadDigits = l.getPhone().replaceAll("[^0-9]", "");
            String leadLast10 = leadDigits.length() >= 10 ? leadDigits.substring(leadDigits.length() - 10) : leadDigits;
            if (leadDigits.equals(digitsOnly) || leadLast10.equals(last10)) {
                return l;
            }
        }
        return null;
    }
}
