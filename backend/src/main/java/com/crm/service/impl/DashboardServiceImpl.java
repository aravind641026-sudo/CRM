package com.crm.service.impl;

import com.crm.dto.response.CallResponse;
import com.crm.dto.response.DashboardSummaryResponse;
import com.crm.dto.response.FollowUpResponse;
import com.crm.mapper.CallMapper;
import com.crm.mapper.FollowUpMapper;
import com.crm.repository.*;
import com.crm.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class DashboardServiceImpl implements DashboardService {

    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final LeadRepository leadRepository;
    private final LeadAssignmentRepository leadAssignmentRepository;
    private final CallRepository callRepository;
    private final FollowUpRepository followUpRepository;
    private final SalesRepository salesRepository;
    private final CallMapper callMapper;
    private final FollowUpMapper followUpMapper;

    @Override
    @Transactional(readOnly = true)
    public DashboardSummaryResponse getAdminDashboardSummary() {
        long totalUsers = userRepository.count();
        List<com.crm.model.User> activeUserList = userRepository.findByStatus("ACTIVE");
        long activeUsers = activeUserList.size();
        long activeAgents = activeUserList.stream()
                .filter(u -> u.getRole() != null && ("ROLE_USER".equalsIgnoreCase(u.getRole().getName()) || "USER".equalsIgnoreCase(u.getRole().getName())))
                .count();
        if (activeAgents == 0 && activeUsers > 0) {
            activeAgents = activeUsers;
        }
        long totalProjects = projectRepository.count();
        long activeProjects = projectRepository.countByStatus("ACTIVE");
        long totalLeads = leadRepository.count();
        long assignedLeads = leadRepository.countAssignedLeads();
        long unassignedLeads = totalLeads - assignedLeads;

        long totalCalls = callRepository.count();
        long connectedCalls = callRepository.countTotalConnectedCalls();
        long missedCalls = callRepository.countByCallStatus("MISSED");
        long noAnswerCalls = callRepository.countByCallStatus("NO_ANSWER");
        long busyCalls = callRepository.countByCallStatus("BUSY");

        // Calls logged today (org-wide)
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = LocalDate.now().atTime(LocalTime.MAX);
        long callsToday = callRepository.countByCreatedAtBetween(startOfDay, endOfDay);

        long interestedLeads = leadRepository.countByBusinessOutcome("INTERESTED");
        long followUpsPending = followUpRepository.countByStatus("PENDING");
        long overdueFollowUps = followUpRepository.countByStatusAndScheduledTimeLessThan("PENDING", LocalDateTime.now());
        long convertedLeads = salesRepository.count();
        BigDecimal totalRevenue = salesRepository.sumTotalDealValue();

        Map<String, Long> statusMap = new HashMap<>();
        statusMap.put("NEW", leadRepository.countByStatus("NEW"));
        statusMap.put("CONTACTED", leadRepository.countByStatus("CONTACTED"));
        statusMap.put("IN_PROGRESS", leadRepository.countByStatus("IN_PROGRESS"));
        statusMap.put("FOLLOW_UP", leadRepository.countByStatus("FOLLOW_UP"));
        statusMap.put("CONVERTED", leadRepository.countByStatus("CONVERTED"));
        statusMap.put("CLOSED", leadRepository.countByStatus("CLOSED"));

        Map<String, Long> outcomeMap = new HashMap<>();
        outcomeMap.put("INTERESTED", interestedLeads);
        outcomeMap.put("NOT_INTERESTED", leadRepository.countByBusinessOutcome("NOT_INTERESTED"));
        outcomeMap.put("FOLLOW_UP", leadRepository.countByBusinessOutcome("FOLLOW_UP"));
        outcomeMap.put("WRONG_NUMBER", leadRepository.countByBusinessOutcome("WRONG_NUMBER"));
        outcomeMap.put("JUNK", leadRepository.countByBusinessOutcome("JUNK"));
        outcomeMap.put("CONVERTED", convertedLeads);

        List<CallResponse> recentCalls = callRepository.findAll(PageRequest.of(0, 5)).getContent().stream()
                .map(callMapper::toResponse)
                .toList();

        return DashboardSummaryResponse.builder()
                .totalUsers(totalUsers)
                .activeUsers(activeUsers)
                .activeAgents(activeAgents)
                .totalProjects(totalProjects)
                .activeProjects(activeProjects)
                .totalLeads(totalLeads)
                .assignedLeads(assignedLeads)
                .unassignedLeads(unassignedLeads)
                .totalCalls(totalCalls)
                .callsToday(callsToday)
                .connectedCalls(connectedCalls)
                .missedCalls(missedCalls)
                .noAnswerCalls(noAnswerCalls)
                .busyCalls(busyCalls)
                .interestedLeads(interestedLeads)
                .followUpsPending(followUpsPending)
                .overdueFollowUps(overdueFollowUps)
                .convertedLeads(convertedLeads)
                .totalRevenue(totalRevenue)
                .leadsByStatus(statusMap)
                .leadsByOutcome(outcomeMap)
                .recentCalls(recentCalls)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public DashboardSummaryResponse getUserDashboardSummary(Long userId) {
        long myAssignedLeads = leadAssignmentRepository.countByUserIdAndIsActiveTrue(userId);

        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = LocalDate.now().atTime(LocalTime.MAX);

        long myCallsToday = callRepository.countByUserIdAndCreatedAtBetween(userId, startOfDay, endOfDay);
        long myConnectedCallsToday = callRepository.countConnectedCallsForUserToday(userId, startOfDay, endOfDay);

        long myPendingFollowUpsToday = followUpRepository.countByUserIdAndStatusAndScheduledTimeBetween(userId, "PENDING", startOfDay, endOfDay);
        long myOverdueFollowUps = followUpRepository.countByUserIdAndStatusAndScheduledTimeLessThan(userId, "PENDING", LocalDateTime.now());

        long interestedLeads = leadRepository.countOutcomeForUser(userId, "INTERESTED");
        long myConversions = salesRepository.countByUserId(userId);

        List<FollowUpResponse> upcomingFollowUps = followUpRepository.findUpcomingFollowUps(userId, endOfDay).stream()
                .limit(5)
                .map(followUpMapper::toResponse)
                .toList();

        List<CallResponse> recentCalls = callRepository.searchCalls(userId, null, null, null, null, null, null, PageRequest.of(0, 5))
                .getContent().stream()
                .map(callMapper::toResponse)
                .toList();

        return DashboardSummaryResponse.builder()
                .myAssignedLeads(myAssignedLeads)
                .myCallsToday(myCallsToday)
                .myConnectedCallsToday(myConnectedCallsToday)
                .myPendingFollowUpsToday(myPendingFollowUpsToday)
                .myOverdueFollowUps(myOverdueFollowUps)
                .interestedLeads(interestedLeads)
                .myConversions(myConversions)
                .totalRevenue(salesRepository.sumDealValueByUserId(userId))
                .upcomingFollowUps(upcomingFollowUps)
                .recentCalls(recentCalls)
                .build();
    }
}
