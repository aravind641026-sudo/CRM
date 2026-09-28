package com.crm.service;

import com.crm.dto.request.LeadCreateRequest;
import com.crm.dto.request.LeadOutcomeRequest;
import com.crm.dto.request.LeadUpdateRequest;
import com.crm.dto.response.LeadDetailResponse;
import com.crm.dto.response.LeadSummaryResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface LeadService {
    LeadSummaryResponse createLead(LeadCreateRequest request, Long currentUserId);
    LeadSummaryResponse updateLead(Long id, LeadUpdateRequest request, Long currentUserId, boolean isAdmin);
    LeadSummaryResponse updateLeadStatus(Long id, String status, String notes, Long currentUserId, boolean isAdmin);
    LeadSummaryResponse updateLeadOutcome(Long id, LeadOutcomeRequest request, Long currentUserId, boolean isAdmin);
    LeadDetailResponse getLeadDetails(Long id, Long currentUserId, boolean isAdmin);
    Page<LeadSummaryResponse> searchLeads(Long projectId, String status, String outcome, String search,
                                         Long currentUserId, boolean isAdmin, Pageable pageable);
    Page<LeadSummaryResponse> searchLeads(Long projectId, String status, String outcome, String search,
                                         Boolean assignedToMe, Long assignedUserId,
                                         Long currentUserId, boolean isAdmin, Pageable pageable);
    void deleteLead(Long id, Long currentUserId);
}
