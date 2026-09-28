package com.crm.controller;

import com.crm.dto.request.AssignmentRequest;
import com.crm.dto.response.ApiResponse;
import com.crm.dto.response.AssignmentHistoryResponse;
import com.crm.security.CurrentUser;
import com.crm.security.UserPrincipal;
import com.crm.service.LeadAssignmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/leads")
@RequiredArgsConstructor
public class LeadAssignmentController {

    private final LeadAssignmentService leadAssignmentService;

    @PostMapping("/{id}/assign")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<AssignmentHistoryResponse>> assignLead(
            @PathVariable Long id,
            @Valid @RequestBody AssignmentRequest request,
            @CurrentUser UserPrincipal principal) {

        AssignmentHistoryResponse response = leadAssignmentService.assignLead(id, request.getUserId(), principal.getId());
        return ResponseEntity.ok(ApiResponse.ok("Lead assigned successfully", response));
    }

    @PostMapping("/assign-bulk")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<AssignmentHistoryResponse>>> bulkAssignLeads(
            @Valid @RequestBody com.crm.dto.request.BulkAssignmentRequest request,
            @CurrentUser UserPrincipal principal) {

        List<AssignmentHistoryResponse> response = leadAssignmentService.bulkAssignLeads(
                request.getLeadIds(), request.getUserId(), principal.getId());
        return ResponseEntity.ok(ApiResponse.ok(response.size() + " leads assigned successfully", response));
    }

    @PostMapping("/{id}/reassign")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<AssignmentHistoryResponse>> reassignLead(
            @PathVariable Long id,
            @Valid @RequestBody AssignmentRequest request,
            @CurrentUser UserPrincipal principal) {

        AssignmentHistoryResponse response = leadAssignmentService.reassignLead(id, request.getUserId(), principal.getId());
        return ResponseEntity.ok(ApiResponse.ok("Lead reassigned successfully", response));
    }

    @GetMapping("/{id}/assignment-history")
    public ResponseEntity<ApiResponse<List<AssignmentHistoryResponse>>> getAssignmentHistory(@PathVariable Long id) {
        List<AssignmentHistoryResponse> history = leadAssignmentService.getAssignmentHistory(id);
        return ResponseEntity.ok(ApiResponse.ok(history));
    }
}
