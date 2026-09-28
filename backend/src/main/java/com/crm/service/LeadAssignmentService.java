package com.crm.service;

import com.crm.dto.response.AssignmentHistoryResponse;
import com.crm.model.LeadAssignment;
import com.crm.model.User;

import java.util.List;
import java.util.Optional;

public interface LeadAssignmentService {
    AssignmentHistoryResponse assignLead(Long leadId, Long userId, Long assignerId);
    AssignmentHistoryResponse reassignLead(Long leadId, Long newUserId, Long assignerId);
    List<AssignmentHistoryResponse> bulkAssignLeads(List<Long> leadIds, Long userId, Long assignerId);
    List<AssignmentHistoryResponse> getAssignmentHistory(Long leadId);
    Optional<LeadAssignment> getActiveAssignment(Long leadId);
    List<User> getPreviousOwners(Long leadId);
    boolean isUserAllowedToAccessLead(Long leadId, Long userId, boolean isAdmin);
}
