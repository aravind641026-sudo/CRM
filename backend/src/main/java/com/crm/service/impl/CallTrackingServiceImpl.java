package com.crm.service.impl;

import com.crm.config.CallTrackingProperties;
import com.crm.dto.request.CallClassificationUpdateRequest;
import com.crm.dto.request.CallEventRequest;
import com.crm.dto.response.CallDashboardStatsResponse;
import com.crm.dto.response.CallResponse;
import com.crm.dto.response.LeadTimelineItemResponse;
import com.crm.exception.ForbiddenException;
import com.crm.exception.ResourceNotFoundException;
import com.crm.mapper.CallMapper;
import com.crm.model.Call;
import com.crm.model.FollowUp;
import com.crm.model.Lead;
import com.crm.model.Project;
import com.crm.model.User;
import com.crm.model.AuditLog;
import com.crm.repository.AuditLogRepository;
import com.crm.repository.CallRepository;
import com.crm.repository.FollowUpRepository;
import com.crm.repository.LeadRepository;
import com.crm.repository.ProjectRepository;
import com.crm.repository.UserRepository;
import com.crm.service.AuditService;
import com.crm.service.CallTrackingService;
import com.crm.service.LeadAssignmentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class CallTrackingServiceImpl implements CallTrackingService {

    private final CallRepository callRepository;
    private final LeadRepository leadRepository;
    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final FollowUpRepository followUpRepository;
    private final AuditLogRepository auditLogRepository;
    private final LeadAssignmentService leadAssignmentService;
    private final AuditService auditService;
    private final CallMapper callMapper;
    private final CallTrackingProperties properties;

    @Override
    @Transactional
    public CallResponse processCallEvent(CallEventRequest request, Long userId, boolean isAdmin) {
        log.info("Processing call event: type={}, telephonyCallId={}, leadId={}, phone={}",
                request.getEventType(), request.getTelephonyCallId(), request.getLeadId(), request.getCustomerPhone());

        LocalDateTime now = request.getTimestamp() != null ? request.getTimestamp() : LocalDateTime.now();

        // 1. Idempotency Check using telephonyCallId first
        Call call = null;
        if (request.getTelephonyCallId() != null && !request.getTelephonyCallId().isBlank()) {
            Optional<Call> existing = callRepository.findByTelephonyCallId(request.getTelephonyCallId());
            if (existing.isPresent()) {
                call = existing.get();
                if ("CALL_INITIATED".equalsIgnoreCase(request.getEventType())) {
                    log.info("Idempotent duplicate CALL_INITIATED for telephonyCallId: {}", request.getTelephonyCallId());
                    return callMapper.toResponse(call);
                }
            }
        }

        // 2. Resolve Lead from user's assigned leads
        Lead lead = null;
        String rawPhone = request.getCustomerPhone();
        if (call != null && call.getLead() != null) {
            lead = call.getLead();
            rawPhone = lead.getPhone();
        } else if (request.getLeadId() != null) {
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

        // 3. Handle Lifecycle State Transitions
        String eventType = request.getEventType().toUpperCase();

        if ("CALL_INITIATED".equals(eventType)) {
            if (call == null) {
                call = Call.builder()
                        .telephonyCallId(request.getTelephonyCallId())
                        .lead(lead)
                        .user(user)
                        .phoneNumber(lead != null ? lead.getPhone() : cleanPhone)
                        .isConnected(false)
                        .callDirection(request.getCallDirection() != null ? request.getCallDirection() : "OUTBOUND")
                        .callLifecycleStatus("INITIATED")
                        .callStatus("INITIATED")
                        .startedAt(now)
                        .durationSeconds(0)
                        .notes(request.getNotes())
                        .build();
                call = callRepository.save(call);
                auditService.logAction(userId, "Call", call.getId(), "CALL_INITIATED", null,
                        "Call initiated to " + (lead != null ? lead.getName() + " (" + lead.getPhone() + ")" : cleanPhone));
            }
            return callMapper.toResponse(call);
        }

        if ("CALL_RINGING".equals(eventType)) {
            if (call != null) {
                call.setCallLifecycleStatus("RINGING");
                call = callRepository.save(call);
            }
            return call != null ? callMapper.toResponse(call) : null;
        }

        if ("CALL_CONNECTED".equals(eventType)) {
            if (call == null) {
                call = Call.builder()
                        .telephonyCallId(request.getTelephonyCallId())
                        .lead(lead)
                        .user(user)
                        .phoneNumber(lead != null ? lead.getPhone() : cleanPhone)
                        .isConnected(true)
                        .callDirection(request.getCallDirection() != null ? request.getCallDirection() : "OUTBOUND")
                        .startedAt(now)
                        .build();
            }
            call.setCallLifecycleStatus("CONNECTED");
            call.setCallStatus("CONNECTED");
            call.setIsConnected(true);
            call.setConnectedAt(now);
            call = callRepository.save(call);
            auditService.logAction(userId, "Call", call.getId(), "CALL_CONNECTED", null,
                    "Call connected with " + (lead != null ? lead.getName() : cleanPhone));
            return callMapper.toResponse(call);
        }

        // Terminal Events: CALL_ENDED, CALL_MISSED, CALL_REJECTED, CALL_FAILED, CALL_CANCELLED
        if (call == null) {
            call = Call.builder()
                    .telephonyCallId(request.getTelephonyCallId())
                    .lead(lead)
                    .user(user)
                    .phoneNumber(lead != null ? lead.getPhone() : cleanPhone)
                    .callDirection(request.getCallDirection() != null ? request.getCallDirection() : "OUTBOUND")
                    .startedAt(now.minusSeconds(request.getDurationSeconds() != null ? request.getDurationSeconds() : 0))
                    .build();
        }

        call.setEndedAt(now);

        // Calculate Duration
        int duration = 0;
        if (request.getDurationSeconds() != null) {
            duration = Math.max(0, request.getDurationSeconds());
        } else if (call.getConnectedAt() != null) {
            duration = (int) Math.max(0, Duration.between(call.getConnectedAt(), now).toSeconds());
        } else if (call.getStartedAt() != null) {
            duration = (int) Math.max(0, Duration.between(call.getStartedAt(), now).toSeconds());
        }
        call.setDurationSeconds(duration);

        // Determine Connection Status
        boolean isConnected = false;
        if (request.getIsConnected() != null) {
            isConnected = request.getIsConnected() && duration > 0;
        } else if ("CALL_MISSED".equals(eventType) || "CALL_REJECTED".equals(eventType) || "CALL_FAILED".equals(eventType) || "CALL_CANCELLED".equals(eventType)) {
            isConnected = false;
        } else if (request.getTechnicalStatus() != null && !request.getTechnicalStatus().isBlank()) {
            isConnected = com.crm.util.CallStatusCalculator.isConnectedResult(request.getTechnicalStatus()) && duration > 0;
        } else if (call.getConnectedAt() != null || "CONNECTED".equalsIgnoreCase(call.getCallLifecycleStatus())) {
            isConnected = duration > 0;
        }

        // Automatic Status Calculation using exact business rules (MISSED, JUNK, CONNECTED, PROSPECT)
        String calculatedStatus = com.crm.util.CallStatusCalculator.calculateStatus(isConnected, duration);

        call.setIsConnected(isConnected);
        call.setCallStatus(calculatedStatus);
        call.setAutomaticClassification(calculatedStatus);
        call.setFinalClassification(calculatedStatus);
        call.setBusinessOutcome(calculatedStatus);
        call.setCallLifecycleStatus("ENDED");
        if (call.getPhoneNumber() == null) {
            call.setPhoneNumber(lead != null ? lead.getPhone() : cleanPhone);
        }

        if (request.getNotes() != null && !request.getNotes().isBlank()) {
            call.setNotes(request.getNotes());
        }

        // Handle Lead update if associated with an assigned lead
        if (lead != null) {
            lead.setBusinessOutcome(calculatedStatus);
            lead.setLastCallStatus(calculatedStatus);
            lead.setLastCallDuration(duration);
            lead.setLastContactedAt(now);

            if (isConnected && "NEW".equalsIgnoreCase(lead.getStatus())) {
                lead.setStatus("CONTACTED");
            }

            // Automatic Follow-Up Creation only for Leads if requested
            if (Boolean.TRUE.equals(request.getFollowUpRequired()) && request.getFollowUpDate() != null) {
                FollowUp followUp = FollowUp.builder()
                        .lead(lead)
                        .user(user)
                        .callId(call.getId())
                        .scheduledTime(request.getFollowUpDate())
                        .status("PENDING")
                        .notes(request.getFollowUpNotes() != null ? request.getFollowUpNotes() : request.getNotes())
                        .build();
                FollowUp savedFollowUp = followUpRepository.save(followUp);

                call.setFollowUpRequired(true);
                call.setFollowUpDate(request.getFollowUpDate());
                call.setFollowUpId(savedFollowUp.getId());

                lead.setFollowUpRequired(true);
                lead.setNextFollowUpAt(request.getFollowUpDate());
            }

            leadRepository.save(lead);
            recalculateLeadMetrics(lead);
        }

        call = callRepository.save(call);

        auditService.logAction(userId, "Call", call.getId(), "CALL_ENDED", null,
                "Status: " + calculatedStatus + ", Duration: " + duration + "s, Lead: " + (lead != null ? lead.getName() : "None"));

        return callMapper.toResponse(call);
    }

    @Override
    @Transactional
    public CallResponse updateCallClassification(Long callId, CallClassificationUpdateRequest request, Long userId, boolean isAdmin) {
        Call call = callRepository.findById(callId)
                .orElseThrow(() -> new ResourceNotFoundException("Call not found with id: " + callId));

        if (!isAdmin && !call.getUser().getId().equals(userId)) {
            throw new ForbiddenException("Access denied: You can only update classifications for your own calls");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        String oldClassification = call.getFinalClassification();
        String newClassification = request.getBusinessClassification().toUpperCase();

        call.setFinalClassification(newClassification);
        call.setBusinessOutcome(newClassification);
        call.setClassificationChangedManually(true);
        call.setClassificationChangedBy(user);
        call.setClassificationChangedAt(LocalDateTime.now());

        if (request.getNotes() != null && !request.getNotes().isBlank()) {
            call.setNotes(request.getNotes());
        }

        Call saved = callRepository.save(call);

        // Update Lead if this is the most recent call
        Lead lead = call.getLead();
        if (lead != null) {
            lead.setBusinessOutcome(newClassification);
            if ("CONVERTED".equalsIgnoreCase(newClassification) || "SALE".equalsIgnoreCase(newClassification)) {
                lead.setStatus("CONVERTED");
            } else if ("FOLLOW_UP".equalsIgnoreCase(newClassification)) {
                lead.setStatus("FOLLOW_UP");
            }
            leadRepository.save(lead);
            recalculateLeadMetrics(lead);
        }

        auditService.logAction(userId, "Call", call.getId(), "STATUS_MANUALLY_CHANGED",
                oldClassification, newClassification);

        return callMapper.toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<LeadTimelineItemResponse> getLeadTimeline(Long leadId, Long userId, boolean isAdmin) {
        if (!leadRepository.existsById(leadId)) {
            throw new ResourceNotFoundException("Lead not found with id: " + leadId);
        }
        if (!leadAssignmentService.isUserAllowedToAccessLead(leadId, userId, isAdmin)) {
            throw new ForbiddenException("Access denied: You are not authorized to view timeline for this lead");
        }

        List<LeadTimelineItemResponse> timeline = new ArrayList<>();

        // 1. Add Calls
        List<Call> calls = callRepository.findByLeadIdOrderByCreatedAtDesc(leadId);
        for (Call c : calls) {
            LocalDateTime ts = c.getStartedAt() != null ? c.getStartedAt() : c.getCreatedAt();
            String techStatus = c.getCallLifecycleStatus() != null ? c.getCallLifecycleStatus() : (Boolean.TRUE.equals(c.getIsConnected()) ? "CONNECTED" : "MISSED");
            timeline.add(LeadTimelineItemResponse.builder()
                    .type("CALL")
                    .id(c.getId())
                    .leadId(leadId)
                    .userId(c.getUser() != null ? c.getUser().getId() : null)
                    .userName(c.getUser() != null ? c.getUser().getName() : "Unknown")
                    .timestamp(ts)
                    .durationSeconds(c.getDurationSeconds())
                    .callDirection(c.getCallDirection())
                    .technicalStatus(techStatus)
                    .businessClassification(c.getFinalClassification())
                    .classificationChangedManually(c.getClassificationChangedManually())
                    .notes(c.getNotes())
                    .followUpRequired(c.getFollowUpRequired())
                    .nextFollowUpAt(c.getFollowUpDate())
                    .title("Phone Call (" + (c.getCallDirection() != null ? c.getCallDirection() : "Outbound") + ")")
                    .build());
        }

        // 2. Add Follow-ups
        List<FollowUp> followUps = followUpRepository.findByLeadIdOrderByScheduledTimeDesc(leadId);
        LocalDateTime now = LocalDateTime.now();
        for (FollowUp fu : followUps) {
            String status = fu.getStatus();
            if ("PENDING".equalsIgnoreCase(status) && fu.getScheduledTime().isBefore(now)) {
                status = "MISSED_FOLLOW_UP";
            }
            timeline.add(LeadTimelineItemResponse.builder()
                    .type("FOLLOW_UP")
                    .id(fu.getId())
                    .leadId(leadId)
                    .userId(fu.getUser() != null ? fu.getUser().getId() : null)
                    .userName(fu.getUser() != null ? fu.getUser().getName() : "Unknown")
                    .timestamp(fu.getScheduledTime())
                    .scheduledTime(fu.getScheduledTime())
                    .followUpStatus(status)
                    .notes(fu.getNotes())
                    .title("Scheduled Follow-up")
                    .build());
        }

        // 3. Add Complete Audit Trail (Created, Assigned, Reassigned, Status Changed, Converted, Updated)
        List<AuditLog> auditLogs = auditLogRepository.findByEntityNameAndEntityIdOrderByCreatedAtDesc("Lead", leadId);
        for (AuditLog al : auditLogs) {
            String title = "Activity Logged";
            String type = "AUDIT";
            String action = al.getAction() != null ? al.getAction().toUpperCase() : "";
            if ("CREATE".equals(action)) {
                title = "Lead created";
                type = "LEAD_CREATED";
            } else if ("ASSIGN".equals(action)) {
                title = "Lead assigned";
                type = "ASSIGNMENT";
            } else if ("REASSIGN".equals(action)) {
                title = "Lead reassigned";
                type = "ASSIGNMENT";
            } else if ("STATUS_CHANGE".equals(action)) {
                title = "Status changed";
                type = "STATUS_CHANGE";
            } else if ("CONVERT".equals(action)) {
                title = "Lead converted";
                type = "CONVERT";
            } else if ("UPDATE".equals(action)) {
                title = "Lead updated";
                type = "UPDATE";
            }
            timeline.add(LeadTimelineItemResponse.builder()
                    .type(type)
                    .id(al.getId())
                    .leadId(leadId)
                    .userId(al.getUser() != null ? al.getUser().getId() : null)
                    .userName(al.getUser() != null ? al.getUser().getName() : "System")
                    .timestamp(al.getCreatedAt())
                    .title(title)
                    .notes(al.getNewValue() != null ? al.getNewValue() : al.getOldValue())
                    .build());
        }

        // Sort descending by timestamp
        timeline.sort((a, b) -> {
            if (a.getTimestamp() == null) return 1;
            if (b.getTimestamp() == null) return -1;
            return b.getTimestamp().compareTo(a.getTimestamp());
        });

        return timeline;
    }

    @Override
    @Transactional(readOnly = true)
    public CallDashboardStatsResponse getCallDashboardStats(Long userId, Long projectId, Long leadId,
                                                           LocalDateTime startDate, LocalDateTime endDate,
                                                           boolean isAdmin) {
        LocalDateTime start = startDate != null ? startDate : LocalDate.now().atStartOfDay();
        LocalDateTime end = endDate != null ? endDate : LocalDate.now().atTime(LocalTime.MAX);

        List<Call> calls;
        if (!isAdmin || userId != null) {
            Long targetUserId = userId != null ? userId : 0L;
            calls = callRepository.findByUserIdAndCreatedAtBetween(targetUserId, start, end);
        } else {
            calls = callRepository.findAll().stream()
                    .filter(c -> c.getCreatedAt() != null && !c.getCreatedAt().isBefore(start) && !c.getCreatedAt().isAfter(end))
                    .toList();
        }

        long totalCalls = calls.size();
        long connectedCalls = calls.stream().filter(c -> Boolean.TRUE.equals(c.getIsConnected()) || "ACCEPTANCE".equalsIgnoreCase(c.getCallStatus()) || "PROSPECT".equalsIgnoreCase(c.getCallStatus()) || "CONNECTED".equalsIgnoreCase(c.getCallStatus())).count();
        long missedCalls = calls.stream().filter(c -> "NOT_ATTENDED".equalsIgnoreCase(c.getCallStatus()) || "MISSED".equalsIgnoreCase(c.getCallStatus()) || "NO_ANSWER".equalsIgnoreCase(c.getCallStatus())).count();
        long rejectedCalls = calls.stream().filter(c -> "REJECTED".equalsIgnoreCase(c.getCallStatus()) || "BUSY".equalsIgnoreCase(c.getCallStatus())).count();
        long failedCalls = calls.stream().filter(c -> "FAILED".equalsIgnoreCase(c.getCallStatus())).count();
        long cancelledCalls = calls.stream().filter(c -> "CANCELLED".equalsIgnoreCase(c.getCallStatus())).count();
        long junkCalls = calls.stream().filter(c -> "JUNK".equalsIgnoreCase(c.getCallStatus()) || "JUNK".equalsIgnoreCase(c.getFinalClassification())).count();
        long shortCalls = junkCalls;
        long followUpCalls = calls.stream().filter(c -> Boolean.TRUE.equals(c.getFollowUpRequired()) || "FOLLOW_UP".equalsIgnoreCase(c.getFinalClassification())).count();

        long totalDurationSeconds = calls.stream().mapToLong(Call::getDurationSeconds).sum();
        double avgDuration = totalCalls > 0 ? (double) totalDurationSeconds / totalCalls : 0;

        // Follow-ups
        LocalDateTime now = LocalDateTime.now();
        List<FollowUp> allFollowUps = followUpRepository.findAll();
        long upcoming = allFollowUps.stream().filter(f -> "PENDING".equalsIgnoreCase(f.getStatus()) && f.getScheduledTime().isAfter(now)).count();
        long today = allFollowUps.stream().filter(f -> "PENDING".equalsIgnoreCase(f.getStatus()) && !f.getScheduledTime().isBefore(start) && !f.getScheduledTime().isAfter(end)).count();
        long missed = allFollowUps.stream().filter(f -> "PENDING".equalsIgnoreCase(f.getStatus()) && f.getScheduledTime().isBefore(now)).count();
        long completed = allFollowUps.stream().filter(f -> "COMPLETED".equalsIgnoreCase(f.getStatus())).count();

        // Leads
        long totalLeads = leadRepository.count();
        long contactedLeads = leadRepository.countByStatus("CONTACTED");
        long notContactedLeads = leadRepository.countByStatus("NEW");
        long interestedLeads = leadRepository.countByBusinessOutcome("PROSPECT") + leadRepository.countByBusinessOutcome("INTERESTED");
        long notInterestedLeads = leadRepository.countByBusinessOutcome("NOT_INTERESTED");
        long followUpLeads = leadRepository.countByStatus("FOLLOW_UP");
        long convertedLeads = leadRepository.countByStatus("CONVERTED");
        long junkLeads = leadRepository.countByBusinessOutcome("JUNK");

        Map<String, Long> lifecycleMap = new HashMap<>();
        lifecycleMap.put("CONNECTED", connectedCalls);
        lifecycleMap.put("MISSED", missedCalls);
        lifecycleMap.put("REJECTED", rejectedCalls);
        lifecycleMap.put("FAILED", failedCalls);
        lifecycleMap.put("CANCELLED", cancelledCalls);

        Map<String, Long> classificationMap = new HashMap<>();
        classificationMap.put("NOT_ATTENDED", missedCalls);
        classificationMap.put("JUNK", junkCalls);
        classificationMap.put("ACCEPTANCE", calls.stream().filter(c -> "ACCEPTANCE".equalsIgnoreCase(c.getCallStatus()) || "ACCEPTABLE".equalsIgnoreCase(c.getFinalClassification())).count());
        classificationMap.put("PROSPECT", calls.stream().filter(c -> "PROSPECT".equalsIgnoreCase(c.getCallStatus()) || "PROSPECT".equalsIgnoreCase(c.getFinalClassification())).count());
        classificationMap.put("CONNECTED", connectedCalls);
        classificationMap.put("FOLLOW_UP", followUpCalls);

        Map<String, Long> statusMap = new HashMap<>();
        statusMap.put("NEW", notContactedLeads);
        statusMap.put("CONTACTED", contactedLeads);
        statusMap.put("IN_PROGRESS", leadRepository.countByStatus("IN_PROGRESS"));
        statusMap.put("FOLLOW_UP", followUpLeads);
        statusMap.put("CONVERTED", convertedLeads);

        return CallDashboardStatsResponse.builder()
                .totalCalls(totalCalls)
                .connectedCalls(connectedCalls)
                .missedCalls(missedCalls)
                .rejectedCalls(rejectedCalls)
                .failedCalls(failedCalls)
                .cancelledCalls(cancelledCalls)
                .shortCalls(shortCalls)
                .junkCalls(junkCalls)
                .followUpCalls(followUpCalls)
                .totalDurationSeconds(totalDurationSeconds)
                .averageDurationSeconds(Math.round(avgDuration * 10.0) / 10.0)
                .upcomingFollowUps(upcoming)
                .todayFollowUps(today)
                .missedFollowUps(missed)
                .completedFollowUps(completed)
                .totalLeads(totalLeads)
                .contactedLeads(contactedLeads)
                .notContactedLeads(notContactedLeads)
                .interestedLeads(interestedLeads)
                .notInterestedLeads(notInterestedLeads)
                .followUpLeads(followUpLeads)
                .convertedLeads(convertedLeads)
                .junkLeads(junkLeads)
                .callsByLifecycleStatus(lifecycleMap)
                .callsByBusinessClassification(classificationMap)
                .leadsByStatus(statusMap)
                .build();
    }

    @Override
    @Transactional
    public void recalculateLeadMetrics(Lead lead) {
        if (lead == null || lead.getId() == null) return;

        List<Call> history = callRepository.findByLeadIdOrderByCreatedAtDesc(lead.getId());
        int total = history.size();
        int connected = 0;
        int missed = 0;
        int rejected = 0;
        int failed = 0;
        int shortCalls = 0;
        int junk = 0;

        for (Call c : history) {
            String st = c.getCallStatus() != null ? c.getCallStatus().toUpperCase() : "";
            String cl = c.getFinalClassification() != null ? c.getFinalClassification().toUpperCase() : "";

            if ("NOT_ATTENDED".equals(st) || "MISSED".equals(st) || "NO_ANSWER".equals(st) || "REJECTED".equals(st) || "BUSY".equals(st) || "FAILED".equals(st)) {
                missed++;
            } else if ("JUNK".equals(st) || "JUNK".equals(cl)) {
                connected++;
                junk++;
            } else if ("ACCEPTANCE".equals(st) || "PROSPECT".equals(st) || "CONNECTED".equals(st)) {
                connected++;
            }
        }

        lead.setTotalCallCount(total);
        lead.setConnectedCallCount(connected);
        lead.setMissedCallCount(missed);
        lead.setRejectedCallCount(rejected);
        lead.setFailedCallCount(failed);
        lead.setShortCallCount(shortCalls);
        lead.setJunkCallCount(junk);

        if (!history.isEmpty()) {
            Call latest = history.get(0);
            lead.setLastCallId(latest.getId());
            lead.setLastCallStatus(latest.getCallStatus());
            lead.setLastCallDuration(latest.getDurationSeconds());
            lead.setLastContactedAt(latest.getEndedAt() != null ? latest.getEndedAt() : latest.getCreatedAt());
        }

        leadRepository.save(lead);
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
