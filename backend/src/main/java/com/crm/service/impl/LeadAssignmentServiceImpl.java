package com.crm.service.impl;

import com.crm.dto.response.AssignmentHistoryResponse;
import com.crm.exception.BusinessException;
import com.crm.exception.ResourceNotFoundException;
import com.crm.mapper.LeadMapper;
import com.crm.model.Lead;
import com.crm.model.LeadAssignment;
import com.crm.model.User;
import com.crm.repository.LeadAssignmentRepository;
import com.crm.repository.LeadRepository;
import com.crm.repository.UserRepository;
import com.crm.service.AuditService;
import com.crm.service.LeadAssignmentService;
import com.crm.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class LeadAssignmentServiceImpl implements LeadAssignmentService {

    private final LeadAssignmentRepository leadAssignmentRepository;
    private final LeadRepository leadRepository;
    private final UserRepository userRepository;
    private final LeadMapper leadMapper;
    private final AuditService auditService;
    private final NotificationService notificationService;

    @Override
    @Transactional
    public AssignmentHistoryResponse assignLead(Long leadId, Long userId, Long assignerId) {
        Lead lead = leadRepository.findById(leadId)
                .orElseThrow(() -> new ResourceNotFoundException("Lead not found with id: " + leadId));

        User targetUser = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        if (!"ACTIVE".equalsIgnoreCase(targetUser.getStatus())) {
            throw new BusinessException("Cannot assign lead to an inactive user");
        }

        User assigner = userRepository.findById(assignerId)
                .orElseThrow(() -> new ResourceNotFoundException("Assigner not found with id: " + assignerId));

        Optional<LeadAssignment> existingActive = leadAssignmentRepository.findByLeadIdAndIsActiveTrue(leadId);
        if (existingActive.isPresent()) {
            // If already assigned, treat as reassignment
            return reassignLead(leadId, userId, assignerId);
        }

        LeadAssignment assignment = LeadAssignment.builder()
                .lead(lead)
                .user(targetUser)
                .assignedBy(assigner)
                .assignedAt(LocalDateTime.now())
                .isActive(true)
                .build();

        LeadAssignment saved = leadAssignmentRepository.save(assignment);

        if ("NEW".equalsIgnoreCase(lead.getStatus())) {
            lead.setStatus("IN_PROGRESS");
            leadRepository.save(lead);
        }

        auditService.logAction(assignerId, "Lead", lead.getId(), "ASSIGN", null,
                "Assigned to: " + targetUser.getName());

        // Notify assigned user
        notificationService.createLeadAssignedNotification(lead, targetUser);

        return leadMapper.toAssignmentHistoryResponse(saved);
    }

    @Override
    @Transactional
    public AssignmentHistoryResponse reassignLead(Long leadId, Long newUserId, Long assignerId) {
        Lead lead = leadRepository.findById(leadId)
                .orElseThrow(() -> new ResourceNotFoundException("Lead not found with id: " + leadId));

        User newUser = userRepository.findById(newUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + newUserId));

        if (!"ACTIVE".equalsIgnoreCase(newUser.getStatus())) {
            throw new BusinessException("Cannot assign lead to an inactive user");
        }

        User assigner = userRepository.findById(assignerId)
                .orElseThrow(() -> new ResourceNotFoundException("Assigner not found with id: " + assignerId));

        Optional<LeadAssignment> existingActive = leadAssignmentRepository.findByLeadIdAndIsActiveTrue(leadId);
        String oldOwnerName = "None";

        if (existingActive.isPresent()) {
            LeadAssignment current = existingActive.get();
            if (current.getUser().getId().equals(newUserId)) {
                return leadMapper.toAssignmentHistoryResponse(current);
            }
            current.setIsActive(false);
            current.setUnassignedAt(LocalDateTime.now());
            leadAssignmentRepository.save(current);
            oldOwnerName = current.getUser().getName();
        }

        LeadAssignment newAssignment = LeadAssignment.builder()
                .lead(lead)
                .user(newUser)
                .assignedBy(assigner)
                .assignedAt(LocalDateTime.now())
                .isActive(true)
                .build();

        LeadAssignment saved = leadAssignmentRepository.save(newAssignment);

        if ("NEW".equalsIgnoreCase(lead.getStatus())) {
            lead.setStatus("IN_PROGRESS");
            leadRepository.save(lead);
        }

        auditService.logAction(assignerId, "Lead", lead.getId(), "REASSIGN",
                "Previous Owner: " + oldOwnerName,
                "New Owner: " + newUser.getName());

        // Notify new assigned user
        notificationService.createLeadAssignedNotification(lead, newUser);

        return leadMapper.toAssignmentHistoryResponse(saved);
    }

    @Override
    @Transactional
    public List<AssignmentHistoryResponse> bulkAssignLeads(List<Long> leadIds, Long userId, Long assignerId) {
        if (leadIds == null || leadIds.isEmpty()) {
            throw new BusinessException("No lead IDs provided for assignment");
        }
        List<AssignmentHistoryResponse> responses = new ArrayList<>();
        for (Long leadId : leadIds) {
            responses.add(assignLead(leadId, userId, assignerId));
        }
        return responses;
    }

    @Override
    @Transactional(readOnly = true)
    public List<AssignmentHistoryResponse> getAssignmentHistory(Long leadId) {
        return leadAssignmentRepository.findByLeadIdOrderByAssignedAtDesc(leadId).stream()
                .map(leadMapper::toAssignmentHistoryResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<LeadAssignment> getActiveAssignment(Long leadId) {
        return leadAssignmentRepository.findByLeadIdAndIsActiveTrue(leadId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<User> getPreviousOwners(Long leadId) {
        List<LeadAssignment> allAssignments = leadAssignmentRepository.findByLeadIdOrderByAssignedAtDesc(leadId);
        List<User> previousOwners = new ArrayList<>();

        for (LeadAssignment a : allAssignments) {
            if (!a.getIsActive() && a.getUser() != null) {
                if (previousOwners.stream().noneMatch(u -> u.getId().equals(a.getUser().getId()))) {
                    previousOwners.add(a.getUser());
                }
            }
        }
        return previousOwners;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isUserAllowedToAccessLead(Long leadId, Long userId, boolean isAdmin) {
        if (isAdmin) {
            return true;
        }
        // User can access if they are currently assigned or have previously handled the lead
        return leadAssignmentRepository.existsByLeadIdAndUserId(leadId, userId);
    }
}
