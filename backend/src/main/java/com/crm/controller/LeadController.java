package com.crm.controller;

import com.crm.dto.request.LeadCreateRequest;
import com.crm.dto.request.LeadOutcomeRequest;
import com.crm.dto.request.LeadUpdateRequest;
import com.crm.dto.response.ApiResponse;
import com.crm.dto.response.LeadDetailResponse;
import com.crm.dto.response.LeadSummaryResponse;
import com.crm.dto.response.PageResponse;
import com.crm.security.CurrentUser;
import com.crm.security.UserPrincipal;
import com.crm.service.LeadService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/leads")
public class LeadController {

    private final LeadService leadService;

    public LeadController(LeadService leadService) {
        this.leadService = leadService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<LeadSummaryResponse>>> searchLeads(
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String outcome,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean assignedToMe,
            @RequestParam(required = false) Long assignedUserId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String direction,
            @CurrentUser UserPrincipal principal) {

        Sort sort = direction.equalsIgnoreCase("asc") ? Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
        Page<LeadSummaryResponse> result = leadService.searchLeads(projectId, status, outcome, search,
                assignedToMe, assignedUserId, principal.getId(), principal.isAdmin(), PageRequest.of(page, size, sort));

        return ResponseEntity.ok(ApiResponse.ok(PageResponse.from(result)));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<LeadSummaryResponse>> createLead(
            @Valid @RequestBody LeadCreateRequest request,
            @CurrentUser UserPrincipal principal) {

        LeadSummaryResponse response = leadService.createLead(request, principal.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Lead created successfully", response));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<LeadDetailResponse>> getLeadDetails(
            @PathVariable Long id,
            @CurrentUser UserPrincipal principal) {

        LeadDetailResponse response = leadService.getLeadDetails(id, principal.getId(), principal.isAdmin());
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<LeadSummaryResponse>> updateLead(
            @PathVariable Long id,
            @Valid @RequestBody LeadUpdateRequest request,
            @CurrentUser UserPrincipal principal) {

        LeadSummaryResponse response = leadService.updateLead(id, request, principal.getId(), principal.isAdmin());
        return ResponseEntity.ok(ApiResponse.ok("Lead updated successfully", response));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<ApiResponse<LeadSummaryResponse>> updateLeadStatus(
            @PathVariable Long id,
            @RequestBody java.util.Map<String, String> request,
            @CurrentUser UserPrincipal principal) {

        String status = request.get("status");
        String notes = request.get("notes");
        LeadSummaryResponse response = leadService.updateLeadStatus(id, status, notes, principal.getId(), principal.isAdmin());
        return ResponseEntity.ok(ApiResponse.ok("Lead status updated successfully", response));
    }

    @PatchMapping("/{id}/outcome")
    public ResponseEntity<ApiResponse<LeadSummaryResponse>> updateLeadOutcome(
            @PathVariable Long id,
            @Valid @RequestBody LeadOutcomeRequest request,
            @CurrentUser UserPrincipal principal) {

        LeadSummaryResponse response = leadService.updateLeadOutcome(id, request, principal.getId(), principal.isAdmin());
        return ResponseEntity.ok(ApiResponse.ok("Lead business outcome updated successfully", response));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<String>> deleteLead(
            @PathVariable Long id,
            @CurrentUser UserPrincipal principal) {

        leadService.deleteLead(id, principal.getId());
        return ResponseEntity.ok(ApiResponse.ok("Lead deleted successfully", null));
    }
}
