package com.crm.controller;

import com.crm.dto.response.ApiResponse;
import com.crm.dto.response.NotificationResponse;
import com.crm.model.AuditLog;
import com.crm.repository.AuditLogRepository;
import com.crm.repository.NotificationRepository;
import com.crm.repository.RoleRepository;
import com.crm.repository.ShiftChangeRequestRepository;
import com.crm.repository.UserRepository;
import com.crm.security.CurrentUser;
import com.crm.security.UserPrincipal;
import com.crm.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final ShiftChangeRequestRepository shiftChangeRequestRepository;
    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final NotificationService notificationService;
    private final NotificationRepository notificationRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<NotificationResponse>>> getUserNotifications(@CurrentUser UserPrincipal principal) {
        List<NotificationResponse> list = notificationService.getUserNotifications(principal.getId());
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<ApiResponse<String>> markAsRead(
            @PathVariable Long id,
            @CurrentUser UserPrincipal principal) {
        notificationService.markNotificationAsRead(id, principal.getId());
        return ResponseEntity.ok(ApiResponse.ok("Notification marked as read", null));
    }

    @PatchMapping("/read-all")
    public ResponseEntity<ApiResponse<String>> markAllAsRead(@CurrentUser UserPrincipal principal) {
        notificationService.markAllNotificationsAsRead(principal.getId());
        return ResponseEntity.ok(ApiResponse.ok("All notifications marked as read", null));
    }

    @GetMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<NotificationResponse>>> getAdminNotifications(@CurrentUser UserPrincipal principal) {
        List<NotificationResponse> list = new ArrayList<>();

        // 1. User Signup Requests (Both PENDING and recently actioned)
        List<com.crm.model.User> signupUsers = userRepository.findAll().stream()
                .filter(u -> u.getStatus() != null && ("PENDING".equalsIgnoreCase(u.getStatus()) || "REJECTED".equalsIgnoreCase(u.getStatus())))
                .sorted(Comparator.comparing(com.crm.model.User::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(30)
                .toList();

        for (com.crm.model.User u : signupUsers) {
            if (u.getRole() != null && "ROLE_ADMIN".equalsIgnoreCase(u.getRole().getName())) {
                continue;
            }
            boolean isPending = "PENDING".equalsIgnoreCase(u.getStatus());
            String title = isPending
                    ? "New User Signup: " + u.getName()
                    : "User Signup (" + u.getStatus() + "): " + u.getName();

            String phoneInfo = (u.getPhone() != null && !u.getPhone().isBlank()) ? " • " + u.getPhone() : "";
            String msg = u.getName() + " (" + u.getEmail() + phoneInfo + ") has requested CRM access."
                    + (isPending ? " Status: PENDING admin approval." : " Status: " + u.getStatus() + ".");

            list.add(NotificationResponse.builder()
                    .id("signup-user-" + u.getId())
                    .type("SIGNUP_REQUEST")
                    .title(title)
                    .message(msg)
                    .createdAt(u.getCreatedAt() != null ? u.getCreatedAt() : LocalDateTime.now())
                    .read(!isPending)
                    .status(u.getStatus())
                    .referenceId(u.getId())
                    .referenceType("UserSignup")
                    .build());
        }

        // Also include stored admin notifications of type SIGNUP_REQUEST / SIGNUP_APPROVED / SIGNUP_REJECTED
        if (principal != null) {
            List<com.crm.model.Notification> adminDbNotifs = notificationRepository.findByUserIdOrderByCreatedAtDesc(principal.getId());
            for (com.crm.model.Notification n : adminDbNotifs) {
                if (n.getType() != null && n.getType().startsWith("SIGNUP_") && n.getReferenceId() != null) {
                    boolean alreadyInList = list.stream().anyMatch(item -> ("signup-user-" + n.getReferenceId()).equals(item.getId()));
                    if (!alreadyInList) {
                        list.add(NotificationResponse.builder()
                                .id("notif-" + n.getId())
                                .type(n.getType())
                                .title(n.getTitle())
                                .message(n.getMessage())
                                .createdAt(n.getCreatedAt() != null ? n.getCreatedAt() : LocalDateTime.now())
                                .read(Boolean.TRUE.equals(n.getIsRead()))
                                .status(n.getStatus() != null ? n.getStatus() : "INFO")
                                .referenceId(n.getReferenceId())
                                .referenceType(n.getReferenceType() != null ? n.getReferenceType() : "UserSignup")
                                .build());
                    }
                }
            }
        }

        // 2. Shift Change Requests
        List<com.crm.model.ShiftChangeRequest> shiftRequests = shiftChangeRequestRepository.findAllByOrderByRequestedAtDesc();
        for (com.crm.model.ShiftChangeRequest sr : shiftRequests) {
            String requesterName = sr.getUser() != null ? sr.getUser().getName() : "A user";
            String curShift = sr.getCurrentShift() != null ? sr.getCurrentShift().getDisplayName() : "Current Shift";
            String reqShift = sr.getRequestedShift() != null ? sr.getRequestedShift().getDisplayName() : "New Shift";

            String title = "PENDING".equalsIgnoreCase(sr.getStatus())
                    ? "Shift Change Request: " + requesterName
                    : "Shift Change (" + sr.getStatus() + "): " + requesterName;

            String desc = requesterName + " has requested a shift change from " + curShift + " to " + reqShift + "."
                    + (sr.getReason() != null && !sr.getReason().isBlank() ? " Reason: " + sr.getReason() : "");

            list.add(NotificationResponse.builder()
                    .id("shift-req-" + sr.getId())
                    .type("SHIFT_CHANGE_REQUEST")
                    .title(title)
                    .message(desc)
                    .createdAt(sr.getRequestedAt() != null ? sr.getRequestedAt() : LocalDateTime.now())
                    .read(!"PENDING".equalsIgnoreCase(sr.getStatus()))
                    .status(sr.getStatus())
                    .referenceId(sr.getId())
                    .referenceType("ShiftChangeRequest")
                    .build());
        }

        // 2. Audit Logs (lead assignments, reassignments, project creations, system actions)
        List<AuditLog> recentLogs = auditLogRepository.searchAuditLogs(null, null, null, PageRequest.of(0, 40)).getContent();
        for (AuditLog log : recentLogs) {
            String actorName = log.getUser() != null ? log.getUser().getName() : "System";
            String type = "SYSTEM_EVENT";
            String action = log.getAction() != null ? log.getAction() : "ACTION";

            if ("ASSIGN".equalsIgnoreCase(action) || "REASSIGN".equalsIgnoreCase(action)) {
                type = "REASSIGN".equalsIgnoreCase(action) ? "LEAD_REASSIGNMENT" : "LEAD_ASSIGNMENT";
            } else if ("CREATE".equalsIgnoreCase(action) && "Project".equalsIgnoreCase(log.getEntityName())) {
                type = "PROJECT_EVENT";
            }

            String title = action + " " + (log.getEntityName() != null ? log.getEntityName() : "");
            String message = actorName + " performed " + action + " on " + log.getEntityName() +
                    (log.getNewValue() != null ? " (" + log.getNewValue() + ")" : "");

            list.add(NotificationResponse.builder()
                    .id("audit-" + log.getId())
                    .type(type)
                    .title(title)
                    .message(message)
                    .createdAt(log.getCreatedAt() != null ? log.getCreatedAt() : LocalDateTime.now())
                    .read(true)
                    .status("INFO")
                    .referenceId(log.getEntityId())
                    .referenceType(log.getEntityName())
                    .build());
        }

        // Sort descending by creation date
        list.sort(Comparator.comparing(NotificationResponse::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())));

        if (list.size() > 50) {
            list = list.subList(0, 50);
        }

        return ResponseEntity.ok(ApiResponse.ok(list));
    }
}
