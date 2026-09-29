package com.crm.service.impl;

import com.crm.dto.request.ChangePasswordRequest;
import com.crm.dto.request.UserCreateRequest;
import com.crm.dto.request.UserStatusRequest;
import com.crm.dto.request.UserUpdateRequest;
import com.crm.dto.response.UserResponse;
import com.crm.exception.BusinessException;
import com.crm.exception.DuplicateResourceException;
import com.crm.exception.ResourceNotFoundException;
import com.crm.mapper.UserMapper;
import com.crm.model.AuditLog;
import com.crm.model.LeadAssignment;
import com.crm.model.Notification;
import com.crm.model.Role;
import com.crm.model.Sale;
import com.crm.model.User;
import com.crm.repository.*;
import com.crm.service.AuditService;
import com.crm.service.FirebaseAuthService;
import com.crm.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    @PersistenceContext
    private final EntityManager entityManager;

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final LeadAssignmentRepository leadAssignmentRepository;
    private final CallRepository callRepository;
    private final NoteRepository noteRepository;
    private final FollowUpRepository followUpRepository;
    private final SalesRepository salesRepository;
    private final AuditLogRepository auditLogRepository;
    private final AttendanceRepository attendanceRepository;
    private final NotificationRepository notificationRepository;
    private final ShiftChangeRequestRepository shiftChangeRequestRepository;
    private final AdminAccessRequestRepository adminAccessRequestRepository;
    private final GoogleSheetsSyncLogRepository googleSheetsSyncLogRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserMapper userMapper;
    private final AuditService auditService;
    private final FirebaseAuthService firebaseAuthService;

    @Override
    @Transactional
    public UserResponse createUser(UserCreateRequest request, Long currentUserId) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateResourceException("User already exists with email: " + request.getEmail());
        }

        String roleName = request.getRole() != null ? request.getRole().toUpperCase() : "USER";
        if (!roleName.startsWith("ROLE_")) {
            roleName = "ROLE_" + roleName;
        }

        String finalRoleName = roleName;
        Role role = roleRepository.findByName(finalRoleName)
                .orElseGet(() -> roleRepository.save(Role.builder().name(finalRoleName).build()));

        // Provision user on Firebase Authentication (Requirement 7 & 8)
        String rawPassword = (request.getPassword() != null && !request.getPassword().isBlank())
                ? request.getPassword()
                : "agent123";

        String firebaseUid = firebaseAuthService.createFirebaseUser(
                request.getEmail().toLowerCase().trim(),
                rawPassword,
                request.getName()
        );

        com.crm.model.WorkShift workShift = (request.getShift() != null && !request.getShift().isBlank())
                ? com.crm.model.WorkShift.fromString(request.getShift())
                : com.crm.model.WorkShift.SHIFT_1000_1900;

        User user = User.builder()
                .name(request.getName())
                .email(request.getEmail().toLowerCase().trim())
                .phone(request.getPhone())
                .password(passwordEncoder.encode(rawPassword))
                .firebaseUid(firebaseUid)
                .role(role)
                .status(request.getStatus() != null ? request.getStatus().toUpperCase() : "ACTIVE")
                .shift(workShift)
                .build();

        User saved = userRepository.save(user);

        auditService.logAction(currentUserId, "User", saved.getId(), "CREATE", null,
                "Name: " + saved.getName() + ", Role: " + saved.getRole().getName() + ", Shift: " + saved.getShift().getDisplayName());

        return userMapper.toResponse(saved, 0, 0);
    }

    @Override
    @Transactional
    public UserResponse registerUser(com.crm.dto.request.UserSignupRequest request) {
        String cleanEmail = request.getEmail().toLowerCase().trim();
        if (userRepository.existsByEmail(cleanEmail)) {
            throw new DuplicateResourceException("An account with email " + cleanEmail + " already exists.");
        }

        Role userRole = roleRepository.findByName("ROLE_USER")
                .orElseGet(() -> roleRepository.save(Role.builder().name("ROLE_USER").build()));

        com.crm.model.WorkShift workShift = (request.getShift() != null && !request.getShift().isBlank())
                ? com.crm.model.WorkShift.fromString(request.getShift())
                : com.crm.model.WorkShift.SHIFT_1000_1900;

        String rawPassword = request.getPassword();
        String firebaseUid = null;
        try {
            firebaseUid = firebaseAuthService.createFirebaseUser(cleanEmail, rawPassword, request.getName());
        } catch (Exception e) {
            log.warn("Firebase user provisioning skipped or deferred: {}", e.getMessage());
        }

        User user = User.builder()
                .name(request.getName().trim())
                .email(cleanEmail)
                .phone(request.getPhone() != null ? request.getPhone().trim() : null)
                .password(passwordEncoder.encode(rawPassword))
                .firebaseUid(firebaseUid)
                .role(userRole)
                .status("PENDING")
                .shift(workShift)
                .build();

        User saved = userRepository.save(user);

        // Create Admin Notification for Pending Signup
        try {
            List<User> admins = userRepository.findAll().stream()
                    .filter(u -> u.getRole() != null && "ROLE_ADMIN".equalsIgnoreCase(u.getRole().getName()))
                    .toList();
            for (User admin : admins) {
                notificationRepository.save(Notification.builder()
                        .user(admin)
                        .type("SIGNUP_REQUEST")
                        .title("New User Signup Request")
                        .message("New user " + saved.getName() + " (" + saved.getEmail() + ") registered and is awaiting approval.")
                        .referenceId(saved.getId())
                        .referenceType("USER_SIGNUP")
                        .status("PENDING")
                        .isRead(false)
                        .build());
            }
        } catch (Exception e) {
            log.warn("Failed to create admin notification for user signup: {}", e.getMessage());
        }

        auditService.logAction(null, "User", saved.getId(), "SIGNUP_REQUEST", null,
                "Name: " + saved.getName() + ", Email: " + saved.getEmail() + ", Status: PENDING");

        return userMapper.toResponse(saved, 0, 0);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<UserResponse> getPendingSignups(Pageable pageable) {
        return userRepository.findByStatus("PENDING", pageable)
                .map(user -> userMapper.toResponse(user, 0, 0));
    }

    @Override
    @Transactional
    public UserResponse approveSignup(Long userId, Long adminUserId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        String oldStatus = user.getStatus();
        user.setStatus("ACTIVE");
        User updated = userRepository.save(user);

        auditService.logAction(adminUserId, "User", updated.getId(), "SIGNUP_APPROVED", oldStatus, "ACTIVE");

        try {
            notificationRepository.save(Notification.builder()
                    .user(updated)
                    .type("SIGNUP_APPROVED")
                    .title("Account Approved")
                    .message("Your account has been approved by admin. You can now login.")
                    .referenceId(updated.getId())
                    .referenceType("USER_SIGNUP")
                    .status("ACTIVE")
                    .isRead(false)
                    .build());

            // Also update any admin notification for this signup request
            List<Notification> adminNotifs = notificationRepository.findAll().stream()
                    .filter(n -> "SIGNUP_REQUEST".equalsIgnoreCase(n.getType()) && userId.equals(n.getReferenceId()))
                    .toList();
            for (Notification n : adminNotifs) {
                n.setStatus("APPROVED");
                n.setIsRead(true);
            }
            notificationRepository.saveAll(adminNotifs);
        } catch (Exception e) {
            log.warn("Failed to update signup notification: {}", e.getMessage());
        }

        long activeLeads = leadAssignmentRepository.countByUserIdAndIsActiveTrue(updated.getId());
        return userMapper.toResponse(updated, activeLeads, 0);
    }

    @Override
    @Transactional
    public UserResponse rejectSignup(Long userId, Long adminUserId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        String oldStatus = user.getStatus();
        user.setStatus("REJECTED");
        User updated = userRepository.save(user);

        auditService.logAction(adminUserId, "User", updated.getId(), "SIGNUP_REJECTED", oldStatus, "REJECTED");

        try {
            List<Notification> adminNotifs = notificationRepository.findAll().stream()
                    .filter(n -> "SIGNUP_REQUEST".equalsIgnoreCase(n.getType()) && userId.equals(n.getReferenceId()))
                    .toList();
            for (Notification n : adminNotifs) {
                n.setStatus("REJECTED");
                n.setIsRead(true);
            }
            notificationRepository.saveAll(adminNotifs);
        } catch (Exception e) {
            log.warn("Failed to update admin signup notification: {}", e.getMessage());
        }

        long activeLeads = leadAssignmentRepository.countByUserIdAndIsActiveTrue(updated.getId());
        return userMapper.toResponse(updated, activeLeads, 0);
    }

    @Override
    @Transactional(readOnly = true)
    public String getSignupStatus(String email) {
        if (email == null || email.isBlank()) {
            return "NOT_FOUND";
        }
        return userRepository.findByEmail(email.toLowerCase().trim())
                .map(User::getStatus)
                .orElse("NOT_FOUND");
    }

    @Override
    @Transactional
    public UserResponse updateUser(Long id, UserUpdateRequest request, Long currentUserId) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));

        String oldDetails = "Name: " + user.getName() + ", Role: " + user.getRole().getName() + ", Status: " + user.getStatus() + ", Shift: " + (user.getShift() != null ? user.getShift().getDisplayName() : "N/A");

        user.setName(request.getName());
        user.setPhone(request.getPhone());

        if (request.getRole() != null) {
            String roleName = request.getRole().toUpperCase();
            if (!roleName.startsWith("ROLE_")) {
                roleName = "ROLE_" + roleName;
            }
            String finalRole = roleName;
            Role role = roleRepository.findByName(finalRole)
                    .orElseGet(() -> roleRepository.save(Role.builder().name(finalRole).build()));
            user.setRole(role);
        }

        if (request.getStatus() != null) {
            user.setStatus(request.getStatus().toUpperCase());
        }

        if (request.getShift() != null && !request.getShift().isBlank()) {
            user.setShift(com.crm.model.WorkShift.fromString(request.getShift()));
        }

        User updated = userRepository.save(user);

        String newDetails = "Name: " + updated.getName() + ", Role: " + updated.getRole().getName() + ", Status: " + updated.getStatus() + ", Shift: " + (updated.getShift() != null ? updated.getShift().getDisplayName() : "N/A");
        auditService.logAction(currentUserId, "User", updated.getId(), "UPDATE", oldDetails, newDetails);

        long activeLeads = leadAssignmentRepository.countByUserIdAndIsActiveTrue(updated.getId());
        long totalCalls = callRepository.countByUserIdAndCreatedAtBetween(updated.getId(), java.time.LocalDateTime.MIN, java.time.LocalDateTime.MAX);

        return userMapper.toResponse(updated, activeLeads, totalCalls);
    }

    @Override
    @Transactional
    public UserResponse toggleUserStatus(Long id, UserStatusRequest request, Long currentUserId) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));

        String oldStatus = user.getStatus();
        String newStatus = (request != null && request.getStatus() != null && !request.getStatus().isBlank())
                ? request.getStatus().toUpperCase()
                : ("ACTIVE".equalsIgnoreCase(oldStatus) ? "INACTIVE" : "ACTIVE");

        user.setStatus(newStatus);
        User updated = userRepository.save(user);

        auditService.logAction(currentUserId, "User", updated.getId(), "STATUS_CHANGE", oldStatus, updated.getStatus());

        long activeLeads = leadAssignmentRepository.countByUserIdAndIsActiveTrue(updated.getId());
        return userMapper.toResponse(updated, activeLeads, 0);
    }

    @Override
    @Transactional
    public String deleteUser(Long id, Long currentUserId) {
        if (id.equals(currentUserId)) {
            throw new BusinessException("You cannot delete your own account.");
        }

        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));

        String userName = user.getName();
        User currentAdmin = userRepository.findById(currentUserId).orElse(null);

        // 1. Clean up lead assignments where assigned_by is this user
        List<LeadAssignment> createdAssignments = leadAssignmentRepository.findByAssignedById(id);
        if (currentAdmin != null && !createdAssignments.isEmpty()) {
            for (LeadAssignment a : createdAssignments) {
                a.setAssignedBy(currentAdmin);
            }
            leadAssignmentRepository.saveAll(createdAssignments);
        }

        // 2. Unassign or delete assignments where user is assigned
        List<LeadAssignment> userAssignments = leadAssignmentRepository.findByUserId(id);
        int assignedLeadCount = userAssignments.size();
        leadAssignmentRepository.deleteAll(userAssignments);

        // 3. Delete or clear audit logs for this user
        auditLogRepository.deleteByUserId(id);

        // 4. Delete follow-ups assigned to this user
        followUpRepository.deleteByUserId(id);

        // 5. Delete or update calls referencing this user
        List<com.crm.model.Call> classifiedCalls = callRepository.findByClassificationChangedById(id);
        if (!classifiedCalls.isEmpty()) {
            for (com.crm.model.Call c : classifiedCalls) {
                c.setClassificationChangedBy(null);
            }
            callRepository.saveAll(classifiedCalls);
        }
        callRepository.deleteByUserId(id);

        // 6. Delete notes authored by this user
        noteRepository.deleteByUserId(id);

        // 7. Clean up sales where user is this user
        List<Sale> sales = salesRepository.findByUserIdOrderByConvertedAtDesc(id);
        salesRepository.deleteAll(sales);

        // 8. Delete attendance records for this user
        attendanceRepository.deleteByUserId(id);

        // 9. Delete notifications for this user
        notificationRepository.deleteByUserId(id);

        // 10. Clean up shift change requests for this user / reviewed by this user
        List<com.crm.model.ShiftChangeRequest> reviewedShifts = shiftChangeRequestRepository.findByReviewedById(id);
        if (currentAdmin != null && !reviewedShifts.isEmpty()) {
            for (com.crm.model.ShiftChangeRequest scr : reviewedShifts) {
                scr.setReviewedBy(currentAdmin);
            }
            shiftChangeRequestRepository.saveAll(reviewedShifts);
        }
        shiftChangeRequestRepository.deleteByUserId(id);

        // 11. Clean up admin access requests for this user / reviewed by this user
        List<com.crm.model.AdminAccessRequest> reviewedAccess = adminAccessRequestRepository.findByReviewedById(id);
        if (currentAdmin != null && !reviewedAccess.isEmpty()) {
            for (com.crm.model.AdminAccessRequest aar : reviewedAccess) {
                aar.setReviewedBy(currentAdmin);
            }
            adminAccessRequestRepository.saveAll(reviewedAccess);
        }
        adminAccessRequestRepository.deleteByUserId(id);

        // 12. Clean up Google sheets sync logs triggered by this user
        googleSheetsSyncLogRepository.deleteByTriggeredById(id);

        // 13. Flush all cascade deletions & updates to MySQL before removing the User row
        entityManager.flush();

        // 14. Delete user from Firebase Auth if linked (safely)
        if (user.getFirebaseUid() != null) {
            try {
                firebaseAuthService.deleteFirebaseUser(user.getFirebaseUid());
            } catch (Exception e) {
                // Continue with DB deletion
            }
        }

        // 15. Delete user from MySQL and flush
        userRepository.delete(user);
        entityManager.flush();

        auditService.logAction(currentUserId, "User", id, "DELETE", user.getEmail(), "DELETED");

        if (assignedLeadCount > 0) {
            return String.format("User '%s' was deleted permanently. %d assigned lead%s unlinked.",
                    userName, assignedLeadCount, assignedLeadCount == 1 ? " was" : "s were");
        } else {
            return String.format("User '%s' was deleted permanently.", userName);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public UserResponse getUserById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));

        long activeLeads = leadAssignmentRepository.countByUserIdAndIsActiveTrue(user.getId());
        return userMapper.toResponse(user, activeLeads, 0);
    }

    @Override
    @Transactional(readOnly = true)
    public UserResponse getUserByEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + email));

        long activeLeads = leadAssignmentRepository.countByUserIdAndIsActiveTrue(user.getId());
        return userMapper.toResponse(user, activeLeads, 0);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<UserResponse> searchUsers(String search, String role, String status, Pageable pageable) {
        String cleanSearch = (search != null && !search.trim().isEmpty()) ? search.trim() : null;

        String cleanRole = null;
        if (role != null && !role.trim().isEmpty() && !role.equalsIgnoreCase("ALL")) {
            cleanRole = role.trim();
            if (!cleanRole.startsWith("ROLE_")) {
                cleanRole = "ROLE_" + cleanRole.toUpperCase();
            }
        }

        String cleanStatus = null;
        if (status != null && !status.trim().isEmpty() && !status.equalsIgnoreCase("ALL")) {
            cleanStatus = status.trim().toUpperCase();
        }

        return userRepository.searchUsers(cleanSearch, cleanRole, cleanStatus, pageable)
                .map(user -> {
                    long activeLeads = leadAssignmentRepository.countByUserIdAndIsActiveTrue(user.getId());
                    return userMapper.toResponse(user, activeLeads, 0);
                });
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserResponse> getActiveUsers() {
        return userRepository.findByStatus("ACTIVE").stream()
                .map(user -> {
                    long activeLeads = leadAssignmentRepository.countByUserIdAndIsActiveTrue(user.getId());
                    return userMapper.toResponse(user, activeLeads, 0);
                })
                .toList();
    }

    @Override
    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new BusinessException("Current password does not match");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        if (user.getFirebaseUid() != null && !user.getFirebaseUid().isBlank()) {
            try {
                firebaseAuthService.updateFirebaseUserPassword(user.getFirebaseUid(), request.getNewPassword());
            } catch (Exception e) {
                // Log and don't block Spring Boot auth
            }
        }

        auditService.logAction(userId, "User", userId, "PASSWORD_CHANGE", null, "Password updated successfully");
    }
}
