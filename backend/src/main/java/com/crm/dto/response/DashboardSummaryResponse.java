package com.crm.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DashboardSummaryResponse {
    // High-level KPI cards
    private long totalUsers;
    private long activeUsers;
    private long activeAgents;
    private long totalProjects;
    private long totalLeads;
    private long assignedLeads;
    private long unassignedLeads;

    // Calls metrics
    private long totalCalls;
    private long callsToday;
    private long connectedCalls;
    private long missedCalls;
    private long noAnswerCalls;
    private long busyCalls;
    private long totalDurationSeconds;

    // Projects
    private long activeProjects;

    // Outcomes & Conversions
    private long interestedLeads;
    private long followUpsPending;
    private long overdueFollowUps;
    private long convertedLeads;
    private BigDecimal totalRevenue;

    // Personal / Agent-specific metrics
    private long myAssignedLeads;
    private long myCallsToday;
    private long myConnectedCallsToday;
    private long myPendingFollowUpsToday;
    private long myOverdueFollowUps;
    private long myConversions;

    // Aggregations
    private Map<String, Long> leadsByStatus;
    private Map<String, Long> leadsByOutcome;
    private List<CallResponse> recentCalls;
    private List<FollowUpResponse> upcomingFollowUps;
}
