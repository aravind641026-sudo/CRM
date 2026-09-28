package com.crm.service.impl;

import com.crm.dto.request.GoogleSheetsPushRequest;
import com.crm.dto.request.GoogleSheetsSyncPayload;
import com.crm.dto.response.GoogleSheetsPullResponse;
import com.crm.dto.response.GoogleSheetsPushResponse;
import com.crm.dto.response.GoogleSheetsSyncResponse;
import com.crm.exception.BusinessException;
import com.crm.exception.GoogleSheetsValidationException;
import com.crm.exception.ResourceNotFoundException;
import com.crm.model.*;
import com.crm.repository.*;
import com.crm.service.AuditService;
import com.crm.service.GoogleAppsScriptClient;
import com.crm.service.GoogleSheetsService;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@Service
@RequiredArgsConstructor
public class GoogleSheetsServiceImpl implements GoogleSheetsService {

    private final GoogleSheetsSyncLogRepository syncLogRepository;
    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final LeadRepository leadRepository;
    private final LeadAssignmentRepository leadAssignmentRepository;
    private final CallRepository callRepository;
    private final FollowUpRepository followUpRepository;
    private final SalesRepository salesRepository;
    private final NoteRepository noteRepository;
    private final AttendanceRepository attendanceRepository;
    private final ShiftChangeRequestRepository shiftChangeRequestRepository;
    private final AdminAccessRequestRepository adminAccessRequestRepository;
    private final AuditLogRepository auditLogRepository;
    private final AuditService auditService;
    private final GoogleAppsScriptClient appsScriptClient;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbcTemplate;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm:ss");
    private static final DateTimeFormatter DATE_ONLY_FORMATTER = DateTimeFormatter.ofPattern("dd-MM-yyyy");

    private static final DateTimeFormatter[] DATE_PARSERS = new DateTimeFormatter[] {
            DateTimeFormatter.ofPattern("d-M-uuuu"),
            DateTimeFormatter.ofPattern("uuuu-M-d"),
            DateTimeFormatter.ofPattern("M-d-uuuu"),
            DateTimeFormatter.ofPattern("d/M/uuuu"),
            DateTimeFormatter.ofPattern("uuuu/M/d"),
            DateTimeFormatter.ofPattern("M/d/uuuu"),
            DateTimeFormatter.ofPattern("d-MMM-uuuu", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("d MMM uuuu", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("MMM d, uuuu", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("MMM-d-uuuu", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("d-MMMM-uuuu", Locale.ENGLISH),
            DateTimeFormatter.ISO_LOCAL_DATE
    };

    private static final DateTimeFormatter[] DATE_TIME_PARSERS = new DateTimeFormatter[] {
            DateTimeFormatter.ofPattern("d-M-uuuu HH:mm:ss"),
            DateTimeFormatter.ofPattern("d-M-uuuu HH:mm"),
            DateTimeFormatter.ofPattern("d-M-uuuu h:mm:ss a", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("d-M-uuuu h:mm a", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("uuuu-M-d HH:mm:ss"),
            DateTimeFormatter.ofPattern("uuuu-M-d HH:mm"),
            DateTimeFormatter.ofPattern("uuuu-M-d'T'HH:mm:ss"),
            DateTimeFormatter.ofPattern("uuuu-M-d'T'HH:mm:ss.SSS"),
            DateTimeFormatter.ofPattern("M-d-uuuu HH:mm:ss"),
            DateTimeFormatter.ofPattern("M-d-uuuu HH:mm"),
            DateTimeFormatter.ofPattern("d/M/uuuu HH:mm:ss"),
            DateTimeFormatter.ofPattern("d/M/uuuu HH:mm"),
            DateTimeFormatter.ofPattern("d/M/uuuu h:mm:ss a", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("d/M/uuuu h:mm a", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("uuuu/M/d HH:mm:ss"),
            DateTimeFormatter.ofPattern("M/d/uuuu HH:mm:ss"),
            DateTimeFormatter.ofPattern("M/d/uuuu HH:mm"),
            DateTimeFormatter.ofPattern("d-MMM-uuuu HH:mm:ss", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("d-MMM-uuuu HH:mm", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("d MMM uuuu HH:mm:ss", Locale.ENGLISH),
            DateTimeFormatter.ISO_LOCAL_DATE_TIME,
            DateTimeFormatter.ISO_OFFSET_DATE_TIME
    };

    private final AtomicBoolean isSyncInProgress = new AtomicBoolean(false);

    // =========================================================================
    // 1. PULL DATABASE SNAPSHOT (Database -> Google Sheets)
    // =========================================================================

    @Override
    @Transactional
    public GoogleSheetsPullResponse pullDatabaseSnapshot(Long adminUserId) {
        if (!isSyncInProgress.compareAndSet(false, true)) {
            throw new BusinessException("A synchronization operation is already in progress. Please wait for it to complete.");
        }

        try {
            User admin = userRepository.findById(adminUserId).orElse(null);
            String adminName = admin != null ? admin.getName() : "Admin";
            String syncCode = "PULL-" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss"));

            log.info("Starting complete CRM database snapshot PULL for Google Sheets [SyncCode: {}]...", syncCode);

            Map<String, List<String>> headersMap = new LinkedHashMap<>();
            Map<String, List<List<Object>>> tablesMap = new LinkedHashMap<>();
            Map<String, Integer> rowCounts = new LinkedHashMap<>();
            int totalRecords = 0;

            // 1. Roles
            List<String> roleHeaders = List.of("id", "name");
            List<List<Object>> roleRows = new ArrayList<>();
            for (Role r : roleRepository.findAll()) {
                roleRows.add(List.of(r.getId(), safeStr(r.getName())));
            }
            addTable(headersMap, tablesMap, rowCounts, "Roles", roleHeaders, roleRows);

            // 2. Projects
            List<String> projectHeaders = List.of("id", "name", "description", "status", "created_at", "updated_at");
            List<List<Object>> projectRows = new ArrayList<>();
            for (Project p : projectRepository.findAll()) {
                projectRows.add(List.of(
                        p.getId(),
                        safeStr(p.getName()),
                        safeStr(p.getDescription()),
                        safeStr(p.getStatus()),
                        formatDate(p.getCreatedAt()),
                        formatDate(p.getUpdatedAt())
                ));
            }
            addTable(headersMap, tablesMap, rowCounts, "Projects", projectHeaders, projectRows);

            // 3. Users
            List<String> userHeaders = List.of("id", "name", "email", "phone", "role_id", "status", "firebase_uid", "created_at", "updated_at");
            List<List<Object>> userRows = new ArrayList<>();
            for (User u : userRepository.findAll()) {
                userRows.add(List.of(
                        u.getId(),
                        safeStr(u.getName()),
                        safeStr(u.getEmail()),
                        safeStr(u.getPhone()),
                        u.getRole() != null ? u.getRole().getId() : "",
                        safeStr(u.getStatus()),
                        safeStr(u.getFirebaseUid()),
                        formatDate(u.getCreatedAt()),
                        formatDate(u.getUpdatedAt())
                ));
            }
            addTable(headersMap, tablesMap, rowCounts, "Users", userHeaders, userRows);

            // 4. Leads
            List<String> leadHeaders = List.of(
                    "id", "project_id", "name", "phone", "email", "address", "city", "state",
                    "source", "status", "business_outcome", "additional_info", "last_contacted_at",
                    "last_call_id", "last_call_status", "last_call_duration", "total_call_count",
                    "connected_call_count", "missed_call_count", "rejected_call_count", "failed_call_count",
                    "short_call_count", "junk_call_count", "follow_up_required", "next_follow_up_at",
                    "created_at", "updated_at"
            );
            List<List<Object>> leadRows = new ArrayList<>();
            for (Lead l : leadRepository.findAll()) {
                leadRows.add(List.of(
                        l.getId(),
                        l.getProject() != null ? l.getProject().getId() : "",
                        safeStr(l.getName()),
                        safeStr(l.getPhone()),
                        safeStr(l.getEmail()),
                        safeStr(l.getAddress()),
                        safeStr(l.getCity()),
                        safeStr(l.getState()),
                        safeStr(l.getSource()),
                        safeStr(l.getStatus()),
                        safeStr(l.getBusinessOutcome()),
                        safeStr(l.getAdditionalInfo()),
                        formatDate(l.getLastContactedAt()),
                        l.getLastCallId() != null ? l.getLastCallId() : "",
                        safeStr(l.getLastCallStatus()),
                        l.getLastCallDuration() != null ? l.getLastCallDuration() : 0,
                        l.getTotalCallCount() != null ? l.getTotalCallCount() : 0,
                        l.getConnectedCallCount() != null ? l.getConnectedCallCount() : 0,
                        l.getMissedCallCount() != null ? l.getMissedCallCount() : 0,
                        l.getRejectedCallCount() != null ? l.getRejectedCallCount() : 0,
                        l.getFailedCallCount() != null ? l.getFailedCallCount() : 0,
                        l.getShortCallCount() != null ? l.getShortCallCount() : 0,
                        l.getJunkCallCount() != null ? l.getJunkCallCount() : 0,
                        Boolean.TRUE.equals(l.getFollowUpRequired()),
                        formatDate(l.getNextFollowUpAt()),
                        formatDate(l.getCreatedAt()),
                        formatDate(l.getUpdatedAt())
                ));
            }
            addTable(headersMap, tablesMap, rowCounts, "Leads", leadHeaders, leadRows);

            // 5. Lead_Assignments
            List<String> assignmentHeaders = List.of("id", "lead_id", "user_id", "assigned_by", "assigned_at", "unassigned_at", "is_active");
            List<List<Object>> assignmentRows = new ArrayList<>();
            for (LeadAssignment a : leadAssignmentRepository.findAll()) {
                assignmentRows.add(List.of(
                        a.getId(),
                        a.getLead() != null ? a.getLead().getId() : "",
                        a.getUser() != null ? a.getUser().getId() : "",
                        a.getAssignedBy() != null ? a.getAssignedBy().getId() : "",
                        formatDate(a.getAssignedAt()),
                        formatDate(a.getUnassignedAt()),
                        Boolean.TRUE.equals(a.getIsActive())
                ));
            }
            addTable(headersMap, tablesMap, rowCounts, "Lead_Assignments", assignmentHeaders, assignmentRows);

            // 6. Calls
            List<String> callHeaders = List.of(
                    "id", "telephony_call_id", "lead_id", "user_id", "phone_number", "is_connected",
                    "call_direction", "call_lifecycle_status", "started_at", "connected_at", "ended_at",
                    "duration_seconds", "call_status", "business_outcome", "automatic_classification",
                    "final_classification", "classification_changed_manually", "classification_changed_by_user_id",
                    "classification_changed_at", "follow_up_required", "follow_up_date", "follow_up_id",
                    "notes", "created_at", "updated_at"
            );
            List<List<Object>> callRows = new ArrayList<>();
            for (Call c : callRepository.findAll()) {
                callRows.add(List.of(
                        c.getId(),
                        safeStr(c.getTelephonyCallId()),
                        c.getLead() != null ? c.getLead().getId() : "",
                        c.getUser() != null ? c.getUser().getId() : "",
                        safeStr(c.getPhoneNumber()),
                        Boolean.TRUE.equals(c.getIsConnected()),
                        safeStr(c.getCallDirection()),
                        safeStr(c.getCallLifecycleStatus()),
                        formatDate(c.getStartedAt()),
                        formatDate(c.getConnectedAt()),
                        formatDate(c.getEndedAt()),
                        c.getDurationSeconds() != null ? c.getDurationSeconds() : 0,
                        safeStr(c.getCallStatus()),
                        safeStr(c.getBusinessOutcome()),
                        safeStr(c.getAutomaticClassification()),
                        safeStr(c.getFinalClassification()),
                        Boolean.TRUE.equals(c.getClassificationChangedManually()),
                        c.getClassificationChangedBy() != null ? c.getClassificationChangedBy().getId() : "",
                        formatDate(c.getClassificationChangedAt()),
                        Boolean.TRUE.equals(c.getFollowUpRequired()),
                        formatDate(c.getFollowUpDate()),
                        c.getFollowUpId() != null ? c.getFollowUpId() : "",
                        safeStr(c.getNotes()),
                        formatDate(c.getCreatedAt()),
                        formatDate(c.getUpdatedAt())
                ));
            }
            addTable(headersMap, tablesMap, rowCounts, "Calls", callHeaders, callRows);

            // 7. Follow_Ups
            List<String> followUpHeaders = List.of("id", "lead_id", "user_id", "scheduled_time", "status", "call_id", "notes", "created_at", "completed_at");
            List<List<Object>> followUpRows = new ArrayList<>();
            for (FollowUp f : followUpRepository.findAll()) {
                followUpRows.add(List.of(
                        f.getId(),
                        f.getLead() != null ? f.getLead().getId() : "",
                        f.getUser() != null ? f.getUser().getId() : "",
                        formatDate(f.getScheduledTime()),
                        safeStr(f.getStatus()),
                        f.getCallId() != null ? f.getCallId() : "",
                        safeStr(f.getNotes()),
                        formatDate(f.getCreatedAt()),
                        formatDate(f.getCompletedAt())
                ));
            }
            addTable(headersMap, tablesMap, rowCounts, "Follow_Ups", followUpHeaders, followUpRows);

            // 8. Sales
            List<String> saleHeaders = List.of("id", "lead_id", "user_id", "deal_value", "notes", "converted_at", "created_at");
            List<List<Object>> saleRows = new ArrayList<>();
            for (Sale s : salesRepository.findAll()) {
                saleRows.add(List.of(
                        s.getId(),
                        s.getLead() != null ? s.getLead().getId() : "",
                        s.getUser() != null ? s.getUser().getId() : "",
                        s.getDealValue() != null ? s.getDealValue() : 0,
                        safeStr(s.getNotes()),
                        formatDate(s.getConvertedAt()),
                        formatDate(s.getCreatedAt())
                ));
            }
            addTable(headersMap, tablesMap, rowCounts, "Sales", saleHeaders, saleRows);

            // 9. Notes
            List<String> noteHeaders = List.of("id", "lead_id", "user_id", "content", "created_at", "updated_at");
            List<List<Object>> noteRows = new ArrayList<>();
            for (Note n : noteRepository.findAll()) {
                noteRows.add(List.of(
                        n.getId(),
                        n.getLead() != null ? n.getLead().getId() : "",
                        n.getUser() != null ? n.getUser().getId() : "",
                        safeStr(n.getContent()),
                        formatDate(n.getCreatedAt()),
                        formatDate(n.getUpdatedAt())
                ));
            }
            addTable(headersMap, tablesMap, rowCounts, "Notes", noteHeaders, noteRows);

            // 10. Attendance
            List<String> attendanceHeaders = List.of("id", "user_id", "attendance_date", "clock_in_time", "clock_out_time", "duration_minutes", "status", "notes", "created_at", "updated_at");
            List<List<Object>> attendanceRows = new ArrayList<>();
            for (Attendance att : attendanceRepository.findAll()) {
                attendanceRows.add(List.of(
                        att.getId(),
                        att.getUser() != null ? att.getUser().getId() : "",
                        formatDateOnly(att.getDate()),
                        formatDate(att.getClockInTime()),
                        formatDate(att.getClockOutTime()),
                        att.getDurationMinutes() != null ? att.getDurationMinutes() : 0,
                        safeStr(att.getStatus()),
                        safeStr(att.getNotes()),
                        formatDate(att.getCreatedAt()),
                        formatDate(att.getUpdatedAt())
                ));
            }
            addTable(headersMap, tablesMap, rowCounts, "Attendance", attendanceHeaders, attendanceRows);

            // 11. Admin_Access_Requests
            List<String> adminReqHeaders = List.of("id", "user_id", "status", "reason", "reviewed_by_user_id", "reviewed_at", "admin_notes", "requested_at", "updated_at");
            List<List<Object>> adminReqRows = new ArrayList<>();
            for (AdminAccessRequest req : adminAccessRequestRepository.findAll()) {
                adminReqRows.add(List.of(
                        req.getId(),
                        req.getUser() != null ? req.getUser().getId() : "",
                        safeStr(req.getStatus()),
                        safeStr(req.getReason()),
                        req.getReviewedBy() != null ? req.getReviewedBy().getId() : "",
                        formatDate(req.getReviewedAt()),
                        safeStr(req.getAdminNotes()),
                        formatDate(req.getRequestedAt()),
                        formatDate(req.getUpdatedAt())
                ));
            }
            addTable(headersMap, tablesMap, rowCounts, "Admin_Access_Requests", adminReqHeaders, adminReqRows);

            // 12. Shift_Change_Requests
            List<String> shiftReqHeaders = List.of("id", "user_id", "current_shift", "requested_shift", "status", "reason", "admin_notes", "reviewed_by_user_id", "reviewed_at", "requested_at", "updated_at");
            List<List<Object>> shiftReqRows = new ArrayList<>();
            for (ShiftChangeRequest scr : shiftChangeRequestRepository.findAll()) {
                shiftReqRows.add(List.of(
                        scr.getId(),
                        scr.getUser() != null ? scr.getUser().getId() : "",
                        scr.getCurrentShift() != null ? scr.getCurrentShift().name() : "",
                        scr.getRequestedShift() != null ? scr.getRequestedShift().name() : "",
                        safeStr(scr.getStatus()),
                        safeStr(scr.getReason()),
                        safeStr(scr.getAdminNotes()),
                        scr.getReviewedBy() != null ? scr.getReviewedBy().getId() : "",
                        formatDate(scr.getReviewedAt()),
                        formatDate(scr.getRequestedAt()),
                        formatDate(scr.getUpdatedAt())
                ));
            }
            addTable(headersMap, tablesMap, rowCounts, "Shift_Change_Requests", shiftReqHeaders, shiftReqRows);

            // 13. Audit_Logs (Read-only historical snapshot)
            List<String> auditHeaders = List.of("id", "user_id", "entity_name", "entity_id", "action", "old_value", "new_value", "created_at");
            List<List<Object>> auditRows = new ArrayList<>();
            for (AuditLog al : auditLogRepository.findAll()) {
                auditRows.add(List.of(
                        al.getId(),
                        al.getUser() != null ? al.getUser().getId() : "",
                        safeStr(al.getEntityName()),
                        al.getEntityId() != null ? al.getEntityId() : "",
                        safeStr(al.getAction()),
                        safeStr(al.getOldValue()),
                        safeStr(al.getNewValue()),
                        formatDate(al.getCreatedAt())
                ));
            }
            addTable(headersMap, tablesMap, rowCounts, "Audit_Logs", auditHeaders, auditRows);

            for (int c : rowCounts.values()) {
                totalRecords += c;
            }

            // Save log record
            GoogleSheetsSyncLog logEntry = GoogleSheetsSyncLog.builder()
                    .syncId(syncCode)
                    .triggeredBy(admin)
                    .status("SUCCESS")
                    .recordsSynced(totalRecords)
                    .usersCount(rowCounts.getOrDefault("Users", 0))
                    .projectsCount(rowCounts.getOrDefault("Projects", 0))
                    .leadsCount(rowCounts.getOrDefault("Leads", 0))
                    .assignmentsCount(rowCounts.getOrDefault("Lead_Assignments", 0))
                    .callsCount(rowCounts.getOrDefault("Calls", 0))
                    .followupsCount(rowCounts.getOrDefault("Follow_Ups", 0))
                    .salesCount(rowCounts.getOrDefault("Sales", 0))
                    .startedAt(LocalDateTime.now())
                    .completedAt(LocalDateTime.now())
                    .build();
            syncLogRepository.save(logEntry);

            log.info("CRM Snapshot PULL completed: {} records across {} tables.", totalRecords, tablesMap.size());

            return GoogleSheetsPullResponse.builder()
                    .success(true)
                    .syncId(syncCode)
                    .syncType("PULL")
                    .timestamp(formatDate(LocalDateTime.now()))
                    .triggeredBy(adminName)
                    .totalRecords(totalRecords)
                    .headers(headersMap)
                    .tables(tablesMap)
                    .rowCounts(rowCounts)
                    .message("Database snapshot generated successfully with " + totalRecords + " total records.")
                    .build();

        } finally {
            isSyncInProgress.set(false);
        }
    }

    private void addTable(Map<String, List<String>> headersMap, Map<String, List<List<Object>>> tablesMap,
                          Map<String, Integer> rowCounts, String name, List<String> headers, List<List<Object>> rows) {
        headersMap.put(name, headers);
        tablesMap.put(name, rows);
        rowCounts.put(name, rows.size());
    }

    // =========================================================================
    // 2. PUSH TO DATABASE (Google Sheets -> Database)
    // =========================================================================

    @Override
    @Transactional(rollbackFor = Exception.class)
    public GoogleSheetsPushResponse pushDatabaseSnapshot(GoogleSheetsPushRequest request, Long adminUserId) {
        if (!isSyncInProgress.compareAndSet(false, true)) {
            throw new BusinessException("A synchronization operation is already in progress. Please wait for it to complete.");
        }

        User admin = userRepository.findById(adminUserId)
                .orElseGet(() -> userRepository.findByEmail("admin@crm.com").orElse(null));

        String syncCode = request.getSyncId() != null && !request.getSyncId().isBlank()
                ? request.getSyncId()
                : "PUSH-" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss"));

        GoogleSheetsSyncLog syncLog = GoogleSheetsSyncLog.builder()
                .syncId(syncCode)
                .triggeredBy(admin)
                .status("IN_PROGRESS")
                .startedAt(LocalDateTime.now())
                .recordsSynced(0)
                .build();
        syncLog = syncLogRepository.save(syncLog);

        try {
            Map<String, List<Map<String, Object>>> tables = request.getTables();
            if (tables == null || tables.isEmpty()) {
                throw new GoogleSheetsValidationException("CRM_SYNC_CONTROL", 1, "tables", "Payload is empty. No table data was received from Google Sheets.");
            }

            // Extract table rows (case-insensitive lookup)
            List<Map<String, Object>> roleRows = getTableRows(tables, "roles", "Roles");
            List<Map<String, Object>> projectRows = getTableRows(tables, "projects", "Projects");
            List<Map<String, Object>> userRows = getTableRows(tables, "users", "Users");
            List<Map<String, Object>> leadRows = getTableRows(tables, "leads", "Leads");
            List<Map<String, Object>> assignmentRows = getTableRows(tables, "lead_assignments", "Lead_Assignments", "leadassignments");
            List<Map<String, Object>> callRows = getTableRows(tables, "calls", "Calls");
            List<Map<String, Object>> followUpRows = getTableRows(tables, "follow_ups", "Follow_Ups", "followups");
            List<Map<String, Object>> saleRows = getTableRows(tables, "sales", "Sales");
            List<Map<String, Object>> noteRows = getTableRows(tables, "notes", "Notes");
            List<Map<String, Object>> attendanceRows = getTableRows(tables, "attendance", "Attendance");
            List<Map<String, Object>> shiftReqRows = getTableRows(tables, "shift_change_requests", "Shift_Change_Requests", "shiftchangerequests");
            List<Map<String, Object>> adminReqRows = getTableRows(tables, "admin_access_requests", "Admin_Access_Requests");

            // =========================================================================
            // PHASE 1: COMPREHENSIVE VALIDATION (ALL TABLES BEFORE ANY DB MODIFICATION)
            // =========================================================================

            // Candidate ID sets (Sheet IDs + Existing DB IDs)
            Set<Long> candidateRoleIds = new HashSet<>();
            roleRepository.findAll().forEach(r -> candidateRoleIds.add(r.getId()));
            Set<String> roleNames = new HashSet<>();

            Set<Long> candidateProjectIds = new HashSet<>();
            projectRepository.findAll().forEach(p -> candidateProjectIds.add(p.getId()));

            Set<Long> candidateUserIds = new HashSet<>();
            userRepository.findAll().forEach(u -> candidateUserIds.add(u.getId()));
            Set<String> userEmails = new HashSet<>();

            Set<Long> candidateLeadIds = new HashSet<>();
            leadRepository.findAll().forEach(l -> candidateLeadIds.add(l.getId()));

            // 1. Validate Roles
            Set<Long> seenRoleIds = new HashSet<>();
            for (int i = 0; i < roleRows.size(); i++) {
                int rowNum = i + 2;
                Map<String, Object> row = roleRows.get(i);
                Long id = parseLong(row.get("id"));
                String name = parseString(row.get("name"));
                if (name == null || name.isBlank()) {
                    throw new GoogleSheetsValidationException("Roles", rowNum, "name", "Role name cannot be empty.");
                }
                if (id != null) {
                    if (!seenRoleIds.add(id)) {
                        throw new GoogleSheetsValidationException("Roles", rowNum, "id", "Duplicate primary key ID " + id + " found in Roles sheet.");
                    }
                    candidateRoleIds.add(id);
                }
                roleNames.add(name);
            }

            // 2. Validate Projects
            Set<Long> seenProjectIds = new HashSet<>();
            for (int i = 0; i < projectRows.size(); i++) {
                int rowNum = i + 2;
                Map<String, Object> row = projectRows.get(i);
                Long id = parseLong(row.get("id"));
                String name = parseString(row.get("name"));
                if (name == null || name.isBlank()) {
                    throw new GoogleSheetsValidationException("Projects", rowNum, "name", "Project name cannot be empty.");
                }
                if (id != null) {
                    if (!seenProjectIds.add(id)) {
                        throw new GoogleSheetsValidationException("Projects", rowNum, "id", "Duplicate primary key ID " + id + " found in Projects sheet.");
                    }
                    candidateProjectIds.add(id);
                }
            }

            // 3. Validate Users
            Set<Long> seenUserIds = new HashSet<>();
            for (int i = 0; i < userRows.size(); i++) {
                int rowNum = i + 2;
                Map<String, Object> row = userRows.get(i);
                Long id = parseLong(row.get("id"));
                String name = parseString(row.get("name"));
                String email = parseString(row.get("email"));
                Long roleId = parseLong(row.get("role_id"));

                if (name == null || name.isBlank()) {
                    throw new GoogleSheetsValidationException("Users", rowNum, "name", "User name cannot be empty.");
                }
                if (email == null || !email.contains("@")) {
                    throw new GoogleSheetsValidationException("Users", rowNum, "email", "Invalid or missing email address: '" + email + "'.");
                }
                if (!userEmails.add(email.toLowerCase())) {
                    throw new GoogleSheetsValidationException("Users", rowNum, "email", "Duplicate email address '" + email + "' found in Users sheet.");
                }
                if (id != null) {
                    if (!seenUserIds.add(id)) {
                        throw new GoogleSheetsValidationException("Users", rowNum, "id", "Duplicate primary key ID " + id + " found in Users sheet.");
                    }
                    candidateUserIds.add(id);
                }
                if (roleId != null && !candidateRoleIds.contains(roleId)) {
                    throw new GoogleSheetsValidationException("Users", rowNum, "role_id", "Role ID " + roleId + " does not exist.");
                }
            }

            // 4. Validate Leads
            Set<Long> seenLeadIds = new HashSet<>();
            for (int i = 0; i < leadRows.size(); i++) {
                int rowNum = i + 2;
                Map<String, Object> row = leadRows.get(i);
                Long id = parseLong(row.get("id"));
                Long projectId = parseLong(row.get("project_id"));
                String name = parseString(row.get("name"));
                String phone = parseString(row.get("phone"));

                if (name == null || name.isBlank()) {
                    throw new GoogleSheetsValidationException("Leads", rowNum, "name", "Lead name cannot be empty.");
                }
                if (phone == null || phone.isBlank()) {
                    throw new GoogleSheetsValidationException("Leads", rowNum, "phone", "Lead phone number cannot be empty.");
                }
                if (projectId == null || !candidateProjectIds.contains(projectId)) {
                    throw new GoogleSheetsValidationException("Leads", rowNum, "project_id", "Project ID " + projectId + " does not exist.");
                }
                if (id != null) {
                    if (!seenLeadIds.add(id)) {
                        throw new GoogleSheetsValidationException("Leads", rowNum, "id", "Duplicate primary key ID " + id + " found in Leads sheet.");
                    }
                    candidateLeadIds.add(id);
                }
            }

            // 5. Validate Lead Assignments
            Set<Long> seenAssignmentIds = new HashSet<>();
            for (int i = 0; i < assignmentRows.size(); i++) {
                int rowNum = i + 2;
                Map<String, Object> row = assignmentRows.get(i);
                Long id = parseLong(row.get("id"));
                Long leadId = parseLong(row.get("lead_id"));
                Long userId = parseLong(row.get("user_id"));
                Long assignedBy = parseLong(row.get("assigned_by"));

                if (id != null && !seenAssignmentIds.add(id)) {
                    throw new GoogleSheetsValidationException("Lead_Assignments", rowNum, "id", "Duplicate primary key ID " + id + " found.");
                }
                if (leadId == null || !candidateLeadIds.contains(leadId)) {
                    throw new GoogleSheetsValidationException("Lead_Assignments", rowNum, "lead_id", "Lead ID " + leadId + " does not exist.");
                }
                if (userId == null || !candidateUserIds.contains(userId)) {
                    throw new GoogleSheetsValidationException("Lead_Assignments", rowNum, "user_id", "User ID " + userId + " does not exist.");
                }
                if (assignedBy != null && !candidateUserIds.contains(assignedBy)) {
                    throw new GoogleSheetsValidationException("Lead_Assignments", rowNum, "assigned_by", "Assigning User ID " + assignedBy + " does not exist.");
                }
            }

            // 6. Validate Calls
            Set<Long> seenCallIds = new HashSet<>();
            for (int i = 0; i < callRows.size(); i++) {
                int rowNum = i + 2;
                Map<String, Object> row = callRows.get(i);
                Long id = parseLong(row.get("id"));
                Long leadId = parseLong(row.get("lead_id"));
                Long userId = parseLong(row.get("user_id"));

                if (id != null && !seenCallIds.add(id)) {
                    throw new GoogleSheetsValidationException("Calls", rowNum, "id", "Duplicate primary key ID " + id + " found.");
                }
                if (userId == null || !candidateUserIds.contains(userId)) {
                    throw new GoogleSheetsValidationException("Calls", rowNum, "user_id", "Caller User ID " + userId + " does not exist.");
                }
                if (leadId != null && !candidateLeadIds.contains(leadId)) {
                    throw new GoogleSheetsValidationException("Calls", rowNum, "lead_id", "Lead ID " + leadId + " does not exist.");
                }
            }

            // 7. Validate Follow_Ups
            Set<Long> seenFollowUpIds = new HashSet<>();
            for (int i = 0; i < followUpRows.size(); i++) {
                int rowNum = i + 2;
                Map<String, Object> row = followUpRows.get(i);
                Long id = parseLong(row.get("id"));
                Long leadId = parseLong(row.get("lead_id"));
                Long userId = parseLong(row.get("user_id"));

                if (id != null && !seenFollowUpIds.add(id)) {
                    throw new GoogleSheetsValidationException("Follow_Ups", rowNum, "id", "Duplicate primary key ID " + id + " found.");
                }
                if (leadId == null || !candidateLeadIds.contains(leadId)) {
                    throw new GoogleSheetsValidationException("Follow_Ups", rowNum, "lead_id", "Lead ID " + leadId + " does not exist.");
                }
                if (userId == null || !candidateUserIds.contains(userId)) {
                    throw new GoogleSheetsValidationException("Follow_Ups", rowNum, "user_id", "User ID " + userId + " does not exist.");
                }
            }

            // 8. Validate Sales
            Set<Long> seenSaleIds = new HashSet<>();
            for (int i = 0; i < saleRows.size(); i++) {
                int rowNum = i + 2;
                Map<String, Object> row = saleRows.get(i);
                Long id = parseLong(row.get("id"));
                Long leadId = parseLong(row.get("lead_id"));
                Long userId = parseLong(row.get("user_id"));

                if (id != null && !seenSaleIds.add(id)) {
                    throw new GoogleSheetsValidationException("Sales", rowNum, "id", "Duplicate primary key ID " + id + " found.");
                }
                if (leadId == null || !candidateLeadIds.contains(leadId)) {
                    throw new GoogleSheetsValidationException("Sales", rowNum, "lead_id", "Lead ID " + leadId + " does not exist.");
                }
                if (userId == null || !candidateUserIds.contains(userId)) {
                    throw new GoogleSheetsValidationException("Sales", rowNum, "user_id", "User ID " + userId + " does not exist.");
                }
            }

            // 9. Validate Notes
            Set<Long> seenNoteIds = new HashSet<>();
            for (int i = 0; i < noteRows.size(); i++) {
                int rowNum = i + 2;
                Map<String, Object> row = noteRows.get(i);
                Long id = parseLong(row.get("id"));
                Long leadId = parseLong(row.get("lead_id"));
                Long userId = parseLong(row.get("user_id"));
                String content = parseString(row.get("content"));

                if (content == null || content.isBlank()) {
                    throw new GoogleSheetsValidationException("Notes", rowNum, "content", "Note content cannot be empty.");
                }
                if (id != null && !seenNoteIds.add(id)) {
                    throw new GoogleSheetsValidationException("Notes", rowNum, "id", "Duplicate primary key ID " + id + " found.");
                }
                if (leadId == null || !candidateLeadIds.contains(leadId)) {
                    throw new GoogleSheetsValidationException("Notes", rowNum, "lead_id", "Lead ID " + leadId + " does not exist.");
                }
                if (userId == null || !candidateUserIds.contains(userId)) {
                    throw new GoogleSheetsValidationException("Notes", rowNum, "user_id", "User ID " + userId + " does not exist.");
                }
            }

            // 10. Validate Attendance
            Set<Long> seenAttIds = new HashSet<>();
            for (int i = 0; i < attendanceRows.size(); i++) {
                int rowNum = i + 2;
                Map<String, Object> row = attendanceRows.get(i);
                Long id = parseLong(getRowValue(row, "id", "attendance_id", "attendanceId"));
                Long userId = parseLong(getRowValue(row, "user_id", "userId", "user"));
                LocalDate date = parseDate(getRowValue(row, "attendance_date", "date", "attendanceDate"));

                // Gracefully skip completely empty rows in sheet
                if (id == null && userId == null && date == null &&
                        getRowValue(row, "clock_in_time", "clockInTime", "status", "notes") == null) {
                    continue;
                }

                // Fallback date inference from clock_in_time, clock_out_time, created_at or existing DB record
                if (date == null) {
                    LocalDateTime clockIn = parseDateTime(getRowValue(row, "clock_in_time", "clockInTime", "clock_in"));
                    if (clockIn != null) {
                        date = clockIn.toLocalDate();
                    } else {
                        LocalDateTime clockOut = parseDateTime(getRowValue(row, "clock_out_time", "clockOutTime", "clock_out"));
                        if (clockOut != null) {
                            date = clockOut.toLocalDate();
                        } else {
                            LocalDateTime createdAt = parseDateTime(getRowValue(row, "created_at", "createdAt"));
                            if (createdAt != null) {
                                date = createdAt.toLocalDate();
                            } else if (id != null && attendanceRepository.existsById(id)) {
                                date = attendanceRepository.findById(id).map(Attendance::getDate).orElse(null);
                            }
                        }
                    }
                }

                if (date == null) {
                    throw new GoogleSheetsValidationException("Attendance", rowNum, "attendance_date", "Attendance date is required and must be in valid date format (dd-MM-yyyy or yyyy-MM-dd).");
                }
                if (id != null && !seenAttIds.add(id)) {
                    throw new GoogleSheetsValidationException("Attendance", rowNum, "id", "Duplicate primary key ID " + id + " found.");
                }
                if (userId == null || !candidateUserIds.contains(userId)) {
                    throw new GoogleSheetsValidationException("Attendance", rowNum, "user_id", "User ID " + userId + " does not exist.");
                }
            }

            // 11. Validate Admin_Access_Requests
            Set<Long> seenReqIds = new HashSet<>();
            for (int i = 0; i < adminReqRows.size(); i++) {
                int rowNum = i + 2;
                Map<String, Object> row = adminReqRows.get(i);
                Long id = parseLong(row.get("id"));
                Long userId = parseLong(row.get("user_id"));

                if (id != null && !seenReqIds.add(id)) {
                    throw new GoogleSheetsValidationException("Admin_Access_Requests", rowNum, "id", "Duplicate primary key ID " + id + " found.");
                }
                if (userId == null || !candidateUserIds.contains(userId)) {
                    throw new GoogleSheetsValidationException("Admin_Access_Requests", rowNum, "user_id", "User ID " + userId + " does not exist.");
                }
            }

            // 12. Validate Shift_Change_Requests
            Set<Long> seenShiftReqIds = new HashSet<>();
            for (int i = 0; i < shiftReqRows.size(); i++) {
                int rowNum = i + 2;
                Map<String, Object> row = shiftReqRows.get(i);
                Long id = parseLong(row.get("id"));
                Long userId = parseLong(row.get("user_id"));

                if (id != null && !seenShiftReqIds.add(id)) {
                    throw new GoogleSheetsValidationException("Shift_Change_Requests", rowNum, "id", "Duplicate primary key ID " + id + " found.");
                }
                if (userId == null || !candidateUserIds.contains(userId)) {
                    throw new GoogleSheetsValidationException("Shift_Change_Requests", rowNum, "user_id", "User ID " + userId + " does not exist.");
                }
            }

            log.info("Google Sheets Push Phase 1 Validation PASSED for all {} tables. Starting database transaction...", tables.size());

            // =========================================================================
            // PHASE 2: TRANSACTIONAL SYNCHRONIZATION (DEPENDENCY ORDER)
            // =========================================================================

            Map<String, Integer> recordsUpdated = new LinkedHashMap<>();

            // 1. Roles
            int updatedRoles = 0;
            for (Map<String, Object> row : roleRows) {
                Long id = parseLong(row.get("id"));
                String name = parseString(row.get("name"));
                Role role = (id != null) ? roleRepository.findById(id).orElse(null) : null;
                if (role == null) {
                    role = roleRepository.findByName(name).orElse(null);
                }
                if (role != null) {
                    role.setName(name);
                    roleRepository.save(role);
                } else {
                    role = Role.builder().name(name).build();
                    roleRepository.save(role);
                }
                updatedRoles++;
            }
            recordsUpdated.put("Roles", updatedRoles);

            // 2. Projects
            int updatedProjects = 0;
            Set<Long> processedProjectIds = new HashSet<>();
            for (Map<String, Object> row : projectRows) {
                Long id = parseLong(row.get("id"));
                String name = parseString(row.get("name"));
                String description = parseString(row.get("description"));
                String status = parseString(row.get("status"));
                if (status == null) status = "ACTIVE";

                Project project = (id != null) ? projectRepository.findById(id).orElse(null) : null;
                if (project != null) {
                    project.setName(name);
                    project.setDescription(description);
                    project.setStatus(status);
                    projectRepository.save(project);
                    processedProjectIds.add(project.getId());
                } else {
                    project = Project.builder().name(name).description(description).status(status).build();
                    Project saved = projectRepository.save(project);
                    processedProjectIds.add(saved.getId());
                }
                updatedProjects++;
            }
            recordsUpdated.put("Projects", updatedProjects);

            // 3. Users
            int updatedUsers = 0;
            Set<Long> processedUserIds = new HashSet<>();
            for (Map<String, Object> row : userRows) {
                Long id = parseLong(getRowValue(row, "id", "userId", "user_id"));
                String name = parseString(getRowValue(row, "name", "userName", "user_name"));
                String email = parseString(getRowValue(row, "email"));
                String phone = parseString(getRowValue(row, "phone", "phone_number", "phoneNumber"));
                Long roleId = parseLong(getRowValue(row, "role_id", "roleId"));
                String roleName = parseString(getRowValue(row, "role", "role_name", "roleName"));
                String status = parseString(getRowValue(row, "status"));
                if (status == null) status = "ACTIVE";
                String firebaseUid = parseString(getRowValue(row, "firebase_uid", "firebaseUid"));

                User user = (id != null) ? userRepository.findById(id).orElse(null) : null;
                if (user == null && email != null) {
                    user = userRepository.findByEmail(email).orElse(null);
                }

                Role role = null;
                if (roleId != null) {
                    role = roleRepository.findById(roleId).orElse(null);
                }
                if (role == null && roleName != null) {
                    String normRole = roleName.trim();
                    if (!normRole.startsWith("ROLE_")) {
                        normRole = "ROLE_" + normRole.toUpperCase();
                    }
                    role = roleRepository.findByName(normRole).orElse(null);
                }
                if (role == null) {
                    role = roleRepository.findByName("ROLE_USER").orElse(null);
                }

                if (user != null) {
                    user.setName(name);
                    user.setEmail(email);
                    if (phone != null) user.setPhone(phone);
                    if (role != null) user.setRole(role);
                    user.setStatus(status);
                    if (firebaseUid != null) user.setFirebaseUid(firebaseUid);
                    userRepository.save(user);
                    processedUserIds.add(user.getId());
                } else {
                    user = User.builder()
                            .name(name)
                            .email(email)
                            .phone(phone)
                            .role(role)
                            .status(status)
                            .password(passwordEncoder.encode("Welcome@123"))
                            .firebaseUid(firebaseUid)
                            .build();
                    User saved = userRepository.save(user);
                    processedUserIds.add(saved.getId());
                }
                updatedUsers++;
            }
            recordsUpdated.put("Users", updatedUsers);

            // 4. Leads
            int updatedLeads = 0;
            Set<Long> processedLeadIds = new HashSet<>();
            for (Map<String, Object> row : leadRows) {
                Long id = parseLong(getRowValue(row, "id", "lead_id", "leadId"));
                Long projectId = parseLong(getRowValue(row, "project_id", "projectId"));
                String name = parseString(getRowValue(row, "name", "lead_name", "leadName"));
                String phone = parseString(getRowValue(row, "phone", "phone_number", "phoneNumber"));
                String email = parseString(getRowValue(row, "email"));
                String address = parseString(getRowValue(row, "address"));
                String city = parseString(getRowValue(row, "city"));
                String state = parseString(getRowValue(row, "state"));
                String source = parseString(getRowValue(row, "source"));
                String status = parseString(getRowValue(row, "status"));
                if (status == null) status = "NEW";
                String outcome = parseString(getRowValue(row, "business_outcome", "businessOutcome"));
                String additionalInfo = parseString(getRowValue(row, "additional_info", "additionalInfo", "notes"));

                Project project = projectId != null ? projectRepository.findById(projectId).orElse(null) : null;

                Lead lead = (id != null) ? leadRepository.findById(id).orElse(null) : null;
                if (lead != null) {
                    if (project != null) lead.setProject(project);
                    lead.setName(name);
                    lead.setPhone(phone);
                    lead.setEmail(email);
                    lead.setAddress(address);
                    lead.setCity(city);
                    lead.setState(state);
                    lead.setSource(source);
                    lead.setStatus(status);
                    lead.setBusinessOutcome(outcome);
                    lead.setAdditionalInfo(additionalInfo);

                    // Call metrics & follow up dates
                    if (row.containsKey("total_call_count")) lead.setTotalCallCount(parseInteger(row.get("total_call_count")));
                    if (row.containsKey("connected_call_count")) lead.setConnectedCallCount(parseInteger(row.get("connected_call_count")));
                    if (row.containsKey("missed_call_count")) lead.setMissedCallCount(parseInteger(row.get("missed_call_count")));
                    if (row.containsKey("rejected_call_count")) lead.setRejectedCallCount(parseInteger(row.get("rejected_call_count")));
                    if (row.containsKey("failed_call_count")) lead.setFailedCallCount(parseInteger(row.get("failed_call_count")));
                    if (row.containsKey("short_call_count")) lead.setShortCallCount(parseInteger(row.get("short_call_count")));
                    if (row.containsKey("junk_call_count")) lead.setJunkCallCount(parseInteger(row.get("junk_call_count")));
                    if (row.containsKey("last_call_id")) lead.setLastCallId(parseLong(row.get("last_call_id")));
                    if (row.containsKey("last_call_status")) lead.setLastCallStatus(parseString(row.get("last_call_status")));
                    if (row.containsKey("last_call_duration")) lead.setLastCallDuration(parseInteger(row.get("last_call_duration")));
                    if (row.containsKey("last_contacted_at")) lead.setLastContactedAt(parseDateTime(row.get("last_contacted_at")));
                    if (row.containsKey("follow_up_required")) lead.setFollowUpRequired(parseBoolean(row.get("follow_up_required")));
                    if (row.containsKey("next_follow_up_at")) lead.setNextFollowUpAt(parseDateTime(row.get("next_follow_up_at")));

                    leadRepository.save(lead);
                    processedLeadIds.add(lead.getId());
                } else {
                    lead = Lead.builder()
                            .project(project)
                            .name(name)
                            .phone(phone)
                            .email(email)
                            .address(address)
                            .city(city)
                            .state(state)
                            .source(source)
                            .status(status)
                            .businessOutcome(outcome)
                            .additionalInfo(additionalInfo)
                            .totalCallCount(parseInteger(row.get("total_call_count")))
                            .connectedCallCount(parseInteger(row.get("connected_call_count")))
                            .missedCallCount(parseInteger(row.get("missed_call_count")))
                            .rejectedCallCount(parseInteger(row.get("rejected_call_count")))
                            .failedCallCount(parseInteger(row.get("failed_call_count")))
                            .shortCallCount(parseInteger(row.get("short_call_count")))
                            .junkCallCount(parseInteger(row.get("junk_call_count")))
                            .lastCallId(parseLong(row.get("last_call_id")))
                            .lastCallStatus(parseString(row.get("last_call_status")))
                            .lastCallDuration(parseInteger(row.get("last_call_duration")))
                            .lastContactedAt(parseDateTime(row.get("last_contacted_at")))
                            .followUpRequired(parseBoolean(row.get("follow_up_required")))
                            .nextFollowUpAt(parseDateTime(row.get("next_follow_up_at")))
                            .build();
                    Lead saved = leadRepository.save(lead);
                    processedLeadIds.add(saved.getId());
                }
                updatedLeads++;
            }
            recordsUpdated.put("Leads", updatedLeads);

            // 5. Lead_Assignments
            int updatedAssignments = 0;
            for (Map<String, Object> row : assignmentRows) {
                Long id = parseLong(getRowValue(row, "id", "assignment_id", "assignmentId"));
                Long leadId = parseLong(getRowValue(row, "lead_id", "leadId"));
                Long userId = parseLong(getRowValue(row, "user_id", "userId"));
                Long assignedById = parseLong(getRowValue(row, "assigned_by", "assignedBy"));
                Boolean isActive = parseBoolean(getRowValue(row, "is_active", "isActive"));
                LocalDateTime assignedAt = parseDateTime(getRowValue(row, "assigned_at", "assignedAt"));
                if (assignedAt == null) assignedAt = LocalDateTime.now();
                LocalDateTime unassignedAt = parseDateTime(getRowValue(row, "unassigned_at", "unassignedAt"));

                Lead lead = leadRepository.findById(leadId).orElse(null);
                User user = userRepository.findById(userId).orElse(null);
                User assignedBy = assignedById != null ? userRepository.findById(assignedById).orElse(admin) : admin;

                if (lead != null && user != null) {
                    LeadAssignment assignment = (id != null) ? leadAssignmentRepository.findById(id).orElse(null) : null;
                    if (assignment != null) {
                        assignment.setLead(lead);
                        assignment.setUser(user);
                        assignment.setAssignedBy(assignedBy);
                        assignment.setIsActive(Boolean.TRUE.equals(isActive));
                        assignment.setAssignedAt(assignedAt);
                        assignment.setUnassignedAt(unassignedAt);
                        leadAssignmentRepository.save(assignment);
                    } else {
                        assignment = LeadAssignment.builder()
                                .lead(lead)
                                .user(user)
                                .assignedBy(assignedBy)
                                .isActive(Boolean.TRUE.equals(isActive))
                                .assignedAt(assignedAt)
                                .unassignedAt(unassignedAt)
                                .build();
                        leadAssignmentRepository.save(assignment);
                    }
                    updatedAssignments++;
                }
            }
            recordsUpdated.put("Lead_Assignments", updatedAssignments);

            // 6. Calls
            int updatedCalls = 0;
            for (Map<String, Object> row : callRows) {
                Long id = parseLong(getRowValue(row, "id", "call_id", "callId"));
                Long leadId = parseLong(getRowValue(row, "lead_id", "leadId"));
                Long userId = parseLong(getRowValue(row, "user_id", "userId"));
                String telephonyCallId = parseString(getRowValue(row, "telephony_call_id", "telephonyCallId"));
                String phoneNumber = parseString(getRowValue(row, "phone_number", "phoneNumber", "phone"));
                Boolean isConnected = parseBoolean(getRowValue(row, "is_connected", "isConnected"));
                String direction = parseString(getRowValue(row, "call_direction", "callDirection"));
                if (direction == null) direction = "OUTBOUND";
                String lifecycle = parseString(getRowValue(row, "call_lifecycle_status", "callLifecycleStatus"));
                if (lifecycle == null) lifecycle = "ENDED";
                LocalDateTime startedAt = parseDateTime(getRowValue(row, "started_at", "startedAt"));
                LocalDateTime connectedAt = parseDateTime(getRowValue(row, "connected_at", "connectedAt"));
                LocalDateTime endedAt = parseDateTime(getRowValue(row, "ended_at", "endedAt"));
                Integer duration = parseInteger(getRowValue(row, "duration_seconds", "durationSeconds", "duration"));
                String callStatus = parseString(getRowValue(row, "call_status", "callStatus"));
                if (callStatus == null) callStatus = "NOT_ATTENDED";
                String outcome = parseString(getRowValue(row, "business_outcome", "businessOutcome"));
                String autoClassification = parseString(getRowValue(row, "automatic_classification", "automaticClassification"));
                String finalClassification = parseString(getRowValue(row, "final_classification", "finalClassification"));
                Boolean manualChanged = parseBoolean(getRowValue(row, "classification_changed_manually", "classificationChangedManually"));
                Long changedByUserId = parseLong(getRowValue(row, "classification_changed_by_user_id", "classificationChangedByUserId"));
                LocalDateTime changedAt = parseDateTime(getRowValue(row, "classification_changed_at", "classificationChangedAt"));
                Boolean followUpReq = parseBoolean(getRowValue(row, "follow_up_required", "followUpRequired"));
                LocalDateTime followUpDate = parseDateTime(getRowValue(row, "follow_up_date", "followUpDate"));
                Long followUpId = parseLong(getRowValue(row, "follow_up_id", "followUpId"));
                String notes = parseString(getRowValue(row, "notes"));

                User user = userRepository.findById(userId).orElse(null);
                Lead lead = leadId != null ? leadRepository.findById(leadId).orElse(null) : null;
                User changedByUser = changedByUserId != null ? userRepository.findById(changedByUserId).orElse(null) : null;

                if (user != null) {
                    Call call = (id != null) ? callRepository.findById(id).orElse(null) : null;
                    if (call != null) {
                        call.setUser(user);
                        call.setLead(lead);
                        call.setTelephonyCallId(telephonyCallId);
                        call.setPhoneNumber(phoneNumber);
                        call.setIsConnected(Boolean.TRUE.equals(isConnected));
                        call.setCallDirection(direction);
                        call.setCallLifecycleStatus(lifecycle);
                        call.setStartedAt(startedAt);
                        call.setConnectedAt(connectedAt);
                        call.setEndedAt(endedAt);
                        call.setDurationSeconds(duration != null ? duration : 0);
                        call.setCallStatus(callStatus);
                        call.setBusinessOutcome(outcome);
                        call.setAutomaticClassification(autoClassification);
                        call.setFinalClassification(finalClassification);
                        call.setClassificationChangedManually(manualChanged);
                        call.setClassificationChangedBy(changedByUser);
                        call.setClassificationChangedAt(changedAt);
                        call.setFollowUpRequired(followUpReq);
                        call.setFollowUpDate(followUpDate);
                        call.setFollowUpId(followUpId);
                        call.setNotes(notes);
                        callRepository.save(call);
                    } else {
                        call = Call.builder()
                                .user(user)
                                .lead(lead)
                                .telephonyCallId(telephonyCallId)
                                .phoneNumber(phoneNumber)
                                .isConnected(Boolean.TRUE.equals(isConnected))
                                .callDirection(direction)
                                .callLifecycleStatus(lifecycle)
                                .startedAt(startedAt)
                                .connectedAt(connectedAt)
                                .endedAt(endedAt)
                                .durationSeconds(duration != null ? duration : 0)
                                .callStatus(callStatus)
                                .businessOutcome(outcome)
                                .automaticClassification(autoClassification)
                                .finalClassification(finalClassification)
                                .classificationChangedManually(manualChanged)
                                .classificationChangedBy(changedByUser)
                                .classificationChangedAt(changedAt)
                                .followUpRequired(followUpReq)
                                .followUpDate(followUpDate)
                                .followUpId(followUpId)
                                .notes(notes)
                                .build();
                        callRepository.save(call);
                    }
                    updatedCalls++;
                }
            }
            recordsUpdated.put("Calls", updatedCalls);

            // 7. Follow_Ups
            int updatedFollowUps = 0;
            for (Map<String, Object> row : followUpRows) {
                Long id = parseLong(row.get("id"));
                Long leadId = parseLong(row.get("lead_id"));
                Long userId = parseLong(row.get("user_id"));
                LocalDateTime scheduledTime = parseDateTime(row.get("scheduled_time"));
                String status = parseString(row.get("status"));
                if (status == null) status = "PENDING";
                Long callId = parseLong(row.get("call_id"));
                String notes = parseString(row.get("notes"));
                LocalDateTime completedAt = parseDateTime(row.get("completed_at"));

                Lead lead = leadRepository.findById(leadId).orElse(null);
                User user = userRepository.findById(userId).orElse(null);

                if (lead != null && user != null && scheduledTime != null) {
                    FollowUp followUp = (id != null) ? followUpRepository.findById(id).orElse(null) : null;
                    if (followUp != null) {
                        followUp.setLead(lead);
                        followUp.setUser(user);
                        followUp.setScheduledTime(scheduledTime);
                        followUp.setStatus(status);
                        followUp.setCallId(callId);
                        followUp.setNotes(notes);
                        followUp.setCompletedAt(completedAt);
                        followUpRepository.save(followUp);
                    } else {
                        followUp = FollowUp.builder()
                                .lead(lead)
                                .user(user)
                                .scheduledTime(scheduledTime)
                                .status(status)
                                .callId(callId)
                                .notes(notes)
                                .completedAt(completedAt)
                                .build();
                        followUpRepository.save(followUp);
                    }
                    updatedFollowUps++;
                }
            }
            recordsUpdated.put("Follow_Ups", updatedFollowUps);

            // 8. Sales
            int updatedSales = 0;
            for (Map<String, Object> row : saleRows) {
                Long id = parseLong(row.get("id"));
                Long leadId = parseLong(row.get("lead_id"));
                Long userId = parseLong(row.get("user_id"));
                BigDecimal dealValue = parseBigDecimal(row.get("deal_value"));
                String notes = parseString(row.get("notes"));
                LocalDateTime convertedAt = parseDateTime(row.get("converted_at"));
                if (convertedAt == null) convertedAt = LocalDateTime.now();

                Lead lead = leadRepository.findById(leadId).orElse(null);
                User user = userRepository.findById(userId).orElse(null);

                if (lead != null && user != null) {
                    Sale sale = (id != null) ? salesRepository.findById(id).orElse(null) : null;
                    if (sale != null) {
                        sale.setLead(lead);
                        sale.setUser(user);
                        sale.setDealValue(dealValue);
                        sale.setNotes(notes);
                        sale.setConvertedAt(convertedAt);
                        salesRepository.save(sale);
                    } else {
                        sale = Sale.builder()
                                .lead(lead)
                                .user(user)
                                .dealValue(dealValue)
                                .notes(notes)
                                .convertedAt(convertedAt)
                                .build();
                        salesRepository.save(sale);
                    }
                    updatedSales++;
                }
            }
            recordsUpdated.put("Sales", updatedSales);

            // 9. Notes
            int updatedNotes = 0;
            for (Map<String, Object> row : noteRows) {
                Long id = parseLong(row.get("id"));
                Long leadId = parseLong(row.get("lead_id"));
                Long userId = parseLong(row.get("user_id"));
                String content = parseString(row.get("content"));

                Lead lead = leadRepository.findById(leadId).orElse(null);
                User user = userRepository.findById(userId).orElse(null);

                if (lead != null && user != null && content != null) {
                    Note note = (id != null) ? noteRepository.findById(id).orElse(null) : null;
                    if (note != null) {
                        note.setLead(lead);
                        note.setUser(user);
                        note.setContent(content);
                        noteRepository.save(note);
                    } else {
                        note = Note.builder().lead(lead).user(user).content(content).build();
                        noteRepository.save(note);
                    }
                    updatedNotes++;
                }
            }
            recordsUpdated.put("Notes", updatedNotes);

            // 10. Attendance
            int updatedAttendance = 0;
            for (Map<String, Object> row : attendanceRows) {
                Long id = parseLong(getRowValue(row, "id", "attendance_id", "attendanceId"));
                Long userId = parseLong(getRowValue(row, "user_id", "userId", "user"));
                LocalDate date = parseDate(getRowValue(row, "attendance_date", "date", "attendanceDate"));
                LocalDateTime clockIn = parseDateTime(getRowValue(row, "clock_in_time", "clockInTime", "clock_in"));
                LocalDateTime clockOut = parseDateTime(getRowValue(row, "clock_out_time", "clockOutTime", "clock_out"));
                Integer duration = parseInteger(getRowValue(row, "duration_minutes", "durationMinutes", "duration"));
                String status = parseString(getRowValue(row, "status"));
                if (status == null) status = "PRESENT";
                String notes = parseString(getRowValue(row, "notes", "note"));

                if (id == null && userId == null && date == null && clockIn == null) {
                    continue;
                }

                if (date == null) {
                    if (clockIn != null) {
                        date = clockIn.toLocalDate();
                    } else if (clockOut != null) {
                        date = clockOut.toLocalDate();
                    } else if (id != null && attendanceRepository.existsById(id)) {
                        date = attendanceRepository.findById(id).map(Attendance::getDate).orElse(null);
                    } else {
                        date = LocalDate.now();
                    }
                }

                User user = userId != null ? userRepository.findById(userId).orElse(null) : null;
                if (user != null && date != null) {
                    Attendance att = (id != null) ? attendanceRepository.findById(id).orElse(null) : null;
                    if (att == null) {
                        att = attendanceRepository.findByUserIdAndDate(userId, date).orElse(null);
                    }
                    if (att != null) {
                        att.setUser(user);
                        att.setDate(date);
                        if (clockIn != null) att.setClockInTime(clockIn);
                        if (clockOut != null) att.setClockOutTime(clockOut);
                        if (duration != null && duration > 0) att.setDurationMinutes(duration);
                        att.setStatus(status);
                        if (notes != null) att.setNotes(notes);
                        attendanceRepository.save(att);
                    } else {
                        att = Attendance.builder()
                                .user(user)
                                .date(date)
                                .clockInTime(clockIn)
                                .clockOutTime(clockOut)
                                .durationMinutes(duration != null ? duration : 0)
                                .status(status)
                                .notes(notes)
                                .build();
                        attendanceRepository.save(att);
                    }
                    updatedAttendance++;
                }
            }
            recordsUpdated.put("Attendance", updatedAttendance);

            // 11. Admin_Access_Requests
            int updatedAdminReqs = 0;
            for (Map<String, Object> row : adminReqRows) {
                Long id = parseLong(row.get("id"));
                Long userId = parseLong(row.get("user_id"));
                String status = parseString(row.get("status"));
                if (status == null) status = "PENDING";
                String reason = parseString(row.get("reason"));
                Long reviewedByUserId = parseLong(row.get("reviewed_by_user_id"));
                LocalDateTime reviewedAt = parseDateTime(row.get("reviewed_at"));
                String adminNotes = parseString(row.get("admin_notes"));

                User user = userRepository.findById(userId).orElse(null);
                User reviewer = reviewedByUserId != null ? userRepository.findById(reviewedByUserId).orElse(null) : null;

                if (user != null) {
                    AdminAccessRequest req = (id != null) ? adminAccessRequestRepository.findById(id).orElse(null) : null;
                    if (req != null) {
                        req.setUser(user);
                        req.setStatus(status);
                        req.setReason(reason);
                        req.setReviewedBy(reviewer);
                        req.setReviewedAt(reviewedAt);
                        req.setAdminNotes(adminNotes);
                        adminAccessRequestRepository.save(req);
                    } else {
                        req = AdminAccessRequest.builder()
                                .user(user)
                                .status(status)
                                .reason(reason)
                                .reviewedBy(reviewer)
                                .reviewedAt(reviewedAt)
                                .adminNotes(adminNotes)
                                .build();
                        adminAccessRequestRepository.save(req);
                    }
                    updatedAdminReqs++;
                }
            }
            recordsUpdated.put("Admin_Access_Requests", updatedAdminReqs);

            // 12. Shift_Change_Requests
            int updatedShiftReqs = 0;
            for (Map<String, Object> row : shiftReqRows) {
                Long id = parseLong(row.get("id"));
                Long userId = parseLong(row.get("user_id"));
                String currentShiftStr = parseString(row.get("current_shift"));
                String requestedShiftStr = parseString(row.get("requested_shift"));
                String status = parseString(row.get("status"));
                if (status == null) status = "PENDING";
                String reason = parseString(row.get("reason"));
                String adminNotes = parseString(row.get("admin_notes"));
                Long reviewedByUserId = parseLong(row.get("reviewed_by_user_id"));
                LocalDateTime reviewedAt = parseDateTime(row.get("reviewed_at"));

                User user = userRepository.findById(userId).orElse(null);
                User reviewer = reviewedByUserId != null ? userRepository.findById(reviewedByUserId).orElse(null) : null;
                WorkShift currentShift = null;
                WorkShift requestedShift = null;
                try {
                    if (currentShiftStr != null) currentShift = WorkShift.valueOf(currentShiftStr);
                } catch (Exception ignored) {}
                try {
                    if (requestedShiftStr != null) requestedShift = WorkShift.valueOf(requestedShiftStr);
                } catch (Exception ignored) {}

                if (user != null) {
                    ShiftChangeRequest scr = (id != null) ? shiftChangeRequestRepository.findById(id).orElse(null) : null;
                    if (scr != null) {
                        scr.setUser(user);
                        if (currentShift != null) scr.setCurrentShift(currentShift);
                        if (requestedShift != null) scr.setRequestedShift(requestedShift);
                        scr.setStatus(status);
                        scr.setReason(reason);
                        scr.setAdminNotes(adminNotes);
                        scr.setReviewedBy(reviewer);
                        scr.setReviewedAt(reviewedAt);
                        shiftChangeRequestRepository.save(scr);
                    } else {
                        scr = ShiftChangeRequest.builder()
                                .user(user)
                                .currentShift(currentShift != null ? currentShift : user.getShift())
                                .requestedShift(requestedShift != null ? requestedShift : WorkShift.SHIFT_1000_1900)
                                .status(status)
                                .reason(reason)
                                .adminNotes(adminNotes)
                                .reviewedBy(reviewer)
                                .reviewedAt(reviewedAt)
                                .build();
                        shiftChangeRequestRepository.save(scr);
                    }
                    updatedShiftReqs++;
                }
            }
            recordsUpdated.put("Shift_Change_Requests", updatedShiftReqs);

            int totalUpdated = 0;
            for (int count : recordsUpdated.values()) {
                totalUpdated += count;
            }

            // Update Sync Log
            syncLog.setStatus("SUCCESS");
            syncLog.setRecordsSynced(totalUpdated);
            syncLog.setUsersCount(updatedUsers);
            syncLog.setProjectsCount(updatedProjects);
            syncLog.setLeadsCount(updatedLeads);
            syncLog.setAssignmentsCount(updatedAssignments);
            syncLog.setCallsCount(updatedCalls);
            syncLog.setFollowupsCount(updatedFollowUps);
            syncLog.setSalesCount(updatedSales);
            syncLog.setCompletedAt(LocalDateTime.now());
            syncLogRepository.save(syncLog);

            // Audit
            auditService.logAction(adminUserId != null ? adminUserId : 1L, "GoogleSheetsPush", syncLog.getId(), "PUSH_SUCCESS", null,
                    "Synchronized complete database from Google Sheets: " + totalUpdated + " records updated.");

            log.info("Database PUSH completed successfully: {} records updated across all tables.", totalUpdated);

            return GoogleSheetsPushResponse.builder()
                    .success(true)
                    .syncId(syncCode)
                    .syncType("PUSH")
                    .timestamp(formatDate(LocalDateTime.now()))
                    .totalRecords(totalUpdated)
                    .recordsUpdated(recordsUpdated)
                    .triggeredBy(admin != null ? admin.getName() : "Admin")
                    .message("Database synchronized successfully: " + totalUpdated + " records updated.")
                    .build();

        } catch (GoogleSheetsValidationException ve) {
            syncLog.setStatus("FAILED");
            syncLog.setErrorMessage(ve.getMessage());
            syncLog.setCompletedAt(LocalDateTime.now());
            syncLogRepository.save(syncLog);
            throw ve;
        } catch (Exception e) {
            syncLog.setStatus("FAILED");
            syncLog.setErrorMessage(e.getMessage());
            syncLog.setCompletedAt(LocalDateTime.now());
            syncLogRepository.save(syncLog);
            throw e;
        } finally {
            isSyncInProgress.set(false);
        }
    }

    // =========================================================================
    // 3. LEGACY / WEB-TRIGGERED FULL SYNC (Admin Panel Web UI)
    // =========================================================================

    @Override
    @Transactional
    public GoogleSheetsSyncResponse triggerSync(Long adminUserId) {
        if (!isSyncInProgress.compareAndSet(false, true)) {
            throw new BusinessException("A synchronization job is already running. Please wait for it to complete.");
        }

        User admin = userRepository.findById(adminUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Admin user not found with id: " + adminUserId));

        String syncCode = "SYNC-" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss"));

        GoogleSheetsSyncLog syncLog = GoogleSheetsSyncLog.builder()
                .syncId(syncCode)
                .triggeredBy(admin)
                .status("IN_PROGRESS")
                .startedAt(LocalDateTime.now())
                .recordsSynced(0)
                .build();
        GoogleSheetsSyncLog savedLog = syncLogRepository.save(syncLog);

        try {
            log.info("Triggering web-based sync to Google Sheets [SyncCode: {}]...", syncCode);

            List<User> users = userRepository.findAll();
            List<Project> projects = projectRepository.findAll();
            List<Lead> leads = leadRepository.findAll();
            List<LeadAssignment> assignments = leadAssignmentRepository.findAll();
            List<Call> calls = callRepository.findAll();
            List<FollowUp> followUps = followUpRepository.findAll();
            List<Sale> sales = salesRepository.findAll();

            int totalRecords = users.size() + projects.size() + leads.size() + assignments.size() + calls.size() + followUps.size() + sales.size();

            GoogleSheetsSyncPayload payload = GoogleSheetsSyncPayload.builder()
                    .syncId(syncCode)
                    .timestamp(formatDate(savedLog.getStartedAt()))
                    .triggeredBy(admin.getName() != null ? admin.getName() : admin.getEmail())
                    .action("sync")
                    .users(mapUsers(users))
                    .projects(mapProjects(projects))
                    .leads(mapLeads(leads))
                    .assignments(mapAssignments(assignments))
                    .calls(mapCalls(calls))
                    .followUps(mapFollowUps(followUps))
                    .sales(mapSales(sales))
                    .build();

            JsonNode scriptResponse = appsScriptClient.sendSyncPayload(payload);

            savedLog.setStatus("SUCCESS");
            savedLog.setRecordsSynced(totalRecords);
            savedLog.setUsersCount(users.size());
            savedLog.setProjectsCount(projects.size());
            savedLog.setLeadsCount(leads.size());
            savedLog.setAssignmentsCount(assignments.size());
            savedLog.setCallsCount(calls.size());
            savedLog.setFollowupsCount(followUps.size());
            savedLog.setSalesCount(sales.size());
            savedLog.setCompletedAt(LocalDateTime.now());
            savedLog.setErrorMessage(null);
            syncLogRepository.save(savedLog);

            return GoogleSheetsSyncResponse.builder()
                    .syncId(savedLog.getId())
                    .syncCode(syncCode)
                    .status("SUCCESS")
                    .recordsSynced(totalRecords)
                    .message("CRM data synchronized successfully into Google Sheets.")
                    .triggeredBy(admin.getName())
                    .startedAt(savedLog.getStartedAt())
                    .completedAt(savedLog.getCompletedAt())
                    .build();

        } catch (Exception e) {
            savedLog.setStatus("FAILED");
            savedLog.setErrorMessage(e.getMessage());
            savedLog.setCompletedAt(LocalDateTime.now());
            syncLogRepository.save(savedLog);
            throw e;
        } finally {
            isSyncInProgress.set(false);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Page<GoogleSheetsSyncLog> getSyncHistory(Pageable pageable) {
        return syncLogRepository.findAllByOrderByStartedAtDesc(pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public GoogleSheetsSyncResponse getLatestSyncStatus() {
        Optional<GoogleSheetsSyncLog> latestOpt = syncLogRepository.findTopByOrderByStartedAtDesc();
        if (latestOpt.isPresent()) {
            GoogleSheetsSyncLog log = latestOpt.get();
            return GoogleSheetsSyncResponse.builder()
                    .syncId(log.getId())
                    .syncCode(log.getSyncId())
                    .status(log.getStatus())
                    .recordsSynced(log.getRecordsSynced() != null ? log.getRecordsSynced() : 0)
                    .message("SUCCESS".equals(log.getStatus()) ? "Database synchronized successfully." : (log.getErrorMessage() != null ? log.getErrorMessage() : "Sync " + log.getStatus()))
                    .triggeredBy(log.getTriggeredBy() != null ? log.getTriggeredBy().getName() : "Admin")
                    .startedAt(log.getStartedAt())
                    .completedAt(log.getCompletedAt())
                    .summary(GoogleSheetsSyncResponse.SyncSummary.builder()
                            .users(log.getUsersCount() != null ? log.getUsersCount() : 0)
                            .projects(log.getProjectsCount() != null ? log.getProjectsCount() : 0)
                            .leads(log.getLeadsCount() != null ? log.getLeadsCount() : 0)
                            .assignments(log.getAssignmentsCount() != null ? log.getAssignmentsCount() : 0)
                            .calls(log.getCallsCount() != null ? log.getCallsCount() : 0)
                            .followUps(log.getFollowupsCount() != null ? log.getFollowupsCount() : 0)
                            .sales(log.getSalesCount() != null ? log.getSalesCount() : 0)
                            .build())
                    .build();
        }
        return GoogleSheetsSyncResponse.builder()
                .status("NONE")
                .message("No synchronization history found.")
                .recordsSynced(0)
                .build();
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    private List<Map<String, Object>> getTableRows(Map<String, List<Map<String, Object>>> tables, String... possibleNames) {
        if (tables == null) return Collections.emptyList();
        for (String name : possibleNames) {
            for (Map.Entry<String, List<Map<String, Object>>> entry : tables.entrySet()) {
                if (entry.getKey().equalsIgnoreCase(name) || entry.getKey().replace("_", "").equalsIgnoreCase(name.replace("_", ""))) {
                    return entry.getValue() != null ? entry.getValue() : Collections.emptyList();
                }
            }
        }
        return Collections.emptyList();
    }

    private Long parseLong(Object val) {
        if (val == null) return null;
        String s = val.toString().trim();
        if (s.isEmpty() || s.equalsIgnoreCase("null")) return null;
        try {
            if (s.contains(".")) {
                return (long) Double.parseDouble(s);
            }
            return Long.parseLong(s);
        } catch (Exception e) {
            return null;
        }
    }

    private Integer parseInteger(Object val) {
        if (val == null) return 0;
        String s = val.toString().trim();
        if (s.isEmpty() || s.equalsIgnoreCase("null")) return 0;
        try {
            if (s.contains(".")) {
                return (int) Double.parseDouble(s);
            }
            return Integer.parseInt(s);
        } catch (Exception e) {
            return 0;
        }
    }

    private Boolean parseBoolean(Object val) {
        if (val == null) return false;
        if (val instanceof Boolean) return (Boolean) val;
        String s = val.toString().trim().toLowerCase();
        return s.equals("true") || s.equals("1") || s.equals("yes");
    }

    private String parseString(Object val) {
        if (val == null) return null;
        String s = val.toString().trim();
        return s.isEmpty() || s.equalsIgnoreCase("null") ? null : s;
    }

    private BigDecimal parseBigDecimal(Object val) {
        if (val == null) return BigDecimal.ZERO;
        String s = val.toString().trim().replace(",", "");
        if (s.isEmpty() || s.equalsIgnoreCase("null")) return BigDecimal.ZERO;
        try {
            return new BigDecimal(s);
        } catch (Exception e) {
            return BigDecimal.ZERO;
        }
    }

    private Object getRowValue(Map<String, Object> row, String... possibleKeys) {
        if (row == null || row.isEmpty() || possibleKeys == null) return null;
        for (String key : possibleKeys) {
            if (row.containsKey(key)) {
                Object val = row.get(key);
                if (val != null && !(val instanceof String && ((String) val).trim().isEmpty())) {
                    return val;
                }
            }
        }
        for (String targetKey : possibleKeys) {
            String normTarget = targetKey.replaceAll("[\\s_\\-]", "").toLowerCase();
            for (Map.Entry<String, Object> entry : row.entrySet()) {
                String normEntry = entry.getKey().replaceAll("[\\s_\\-]", "").toLowerCase();
                if (normEntry.equals(normTarget)) {
                    Object val = entry.getValue();
                    if (val != null && !(val instanceof String && ((String) val).trim().isEmpty())) {
                        return val;
                    }
                }
            }
        }
        return null;
    }

    private LocalDateTime parseDateTime(Object val) {
        if (val == null) return null;
        if (val instanceof LocalDateTime) return (LocalDateTime) val;
        if (val instanceof LocalDate) return ((LocalDate) val).atStartOfDay();
        if (val instanceof java.util.Date) {
            return ((java.util.Date) val).toInstant().atZone(ZoneId.of("Asia/Kolkata")).toLocalDateTime();
        }
        if (val instanceof Number) {
            double num = ((Number) val).doubleValue();
            if (num > 100_000_000_000L) {
                return Instant.ofEpochMilli((long) num).atZone(ZoneId.of("Asia/Kolkata")).toLocalDateTime();
            }
            if (num > 20000 && num < 80000) {
                long wholeDays = (long) num;
                double fraction = num - wholeDays;
                long millisInDay = (long) (fraction * 86_400_000);
                return LocalDate.of(1899, 12, 30).plusDays(wholeDays).atStartOfDay().plus(Duration.ofMillis(millisInDay));
            }
        }

        String s = val.toString().trim().replace("\u00A0", " ").replaceAll("^[\"']+|[\"']+$", "").trim();
        if (s.isEmpty() || s.equalsIgnoreCase("null") || s.equals("-")) return null;

        try {
            if (s.endsWith("Z")) {
                return Instant.parse(s).atZone(ZoneId.of("Asia/Kolkata")).toLocalDateTime();
            }
            if (s.contains("+") || (s.lastIndexOf('-') > 7 && s.contains("T"))) {
                return OffsetDateTime.parse(s).atZoneSameInstant(ZoneId.of("Asia/Kolkata")).toLocalDateTime();
            }
            return LocalDateTime.parse(s);
        } catch (Exception ignored) {}

        for (DateTimeFormatter fmt : DATE_TIME_PARSERS) {
            try {
                return LocalDateTime.parse(s, fmt);
            } catch (Exception ignored) {}
        }

        String dashNorm = s.replace('/', '-');
        for (DateTimeFormatter fmt : DATE_TIME_PARSERS) {
            try {
                return LocalDateTime.parse(dashNorm, fmt);
            } catch (Exception ignored) {}
        }

        LocalDate ld = parseDate(s);
        if (ld != null) {
            return ld.atStartOfDay();
        }

        return null;
    }

    private LocalDate parseDate(Object val) {
        if (val == null) return null;
        if (val instanceof LocalDate) return (LocalDate) val;
        if (val instanceof LocalDateTime) return ((LocalDateTime) val).toLocalDate();
        if (val instanceof java.util.Date) {
            return ((java.util.Date) val).toInstant().atZone(ZoneId.of("Asia/Kolkata")).toLocalDate();
        }
        if (val instanceof Number) {
            double num = ((Number) val).doubleValue();
            if (num > 100_000_000_000L) {
                return Instant.ofEpochMilli((long) num).atZone(ZoneId.of("Asia/Kolkata")).toLocalDate();
            }
            if (num > 20000 && num < 80000) {
                return LocalDate.of(1899, 12, 30).plusDays((long) num);
            }
        }

        String s = val.toString().trim().replace("\u00A0", " ").replaceAll("^[\"']+|[\"']+$", "").trim();
        if (s.isEmpty() || s.equalsIgnoreCase("null") || s.equals("-")) return null;

        if (s.contains(" ") || s.contains("T")) {
            LocalDateTime ldt = parseDateTime(s);
            if (ldt != null) {
                return ldt.toLocalDate();
            }
            int cutIdx = s.contains("T") ? s.indexOf("T") : s.indexOf(" ");
            if (cutIdx > 0) {
                s = s.substring(0, cutIdx).trim();
            }
        }

        try {
            return LocalDate.parse(s);
        } catch (Exception ignored) {}

        for (DateTimeFormatter fmt : DATE_PARSERS) {
            try {
                return LocalDate.parse(s, fmt);
            } catch (Exception ignored) {}
        }

        String dashNormalized = s.replace('/', '-').replace('.', '-');
        for (DateTimeFormatter fmt : DATE_PARSERS) {
            try {
                return LocalDate.parse(dashNormalized, fmt);
            } catch (Exception ignored) {}
        }

        return null;
    }

    private String safeStr(String val) {
        return val != null ? val : "";
    }

    private String formatDate(LocalDateTime dateTime) {
        if (dateTime == null) return "";
        return dateTime.format(DATE_FORMATTER);
    }

    private String formatDateOnly(LocalDate date) {
        if (date == null) return "";
        return date.format(DATE_ONLY_FORMATTER);
    }

    private List<GoogleSheetsSyncPayload.UserSyncItem> mapUsers(List<User> users) {
        List<GoogleSheetsSyncPayload.UserSyncItem> list = new ArrayList<>();
        for (User u : users) {
            list.add(GoogleSheetsSyncPayload.UserSyncItem.builder()
                    .id(u.getId())
                    .name(u.getName())
                    .email(u.getEmail())
                    .phone(u.getPhone())
                    .role(u.getRole() != null ? u.getRole().getName() : "ROLE_USER")
                    .status(u.getStatus() != null ? u.getStatus() : "ACTIVE")
                    .createdAt(formatDate(u.getCreatedAt()))
                    .updatedAt(formatDate(u.getUpdatedAt()))
                    .build());
        }
        return list;
    }

    private List<GoogleSheetsSyncPayload.ProjectSyncItem> mapProjects(List<Project> projects) {
        List<GoogleSheetsSyncPayload.ProjectSyncItem> list = new ArrayList<>();
        for (Project p : projects) {
            list.add(GoogleSheetsSyncPayload.ProjectSyncItem.builder()
                    .id(p.getId())
                    .name(p.getName())
                    .description(p.getDescription())
                    .status(p.getStatus() != null ? p.getStatus() : "ACTIVE")
                    .createdBy("System")
                    .createdAt(formatDate(p.getCreatedAt()))
                    .updatedAt(formatDate(p.getUpdatedAt()))
                    .build());
        }
        return list;
    }

    private List<GoogleSheetsSyncPayload.LeadSyncItem> mapLeads(List<Lead> leads) {
        List<GoogleSheetsSyncPayload.LeadSyncItem> list = new ArrayList<>();
        for (Lead l : leads) {
            boolean interested = "INTERESTED".equalsIgnoreCase(l.getBusinessOutcome());
            boolean converted = "CONVERTED".equalsIgnoreCase(l.getStatus()) || "SALE".equalsIgnoreCase(l.getBusinessOutcome());

            list.add(GoogleSheetsSyncPayload.LeadSyncItem.builder()
                    .id(l.getId())
                    .projectId(l.getProject() != null ? l.getProject().getId() : null)
                    .projectName(l.getProject() != null ? l.getProject().getName() : "Unassigned")
                    .name(l.getName())
                    .phone(l.getPhone())
                    .email(l.getEmail())
                    .city(l.getCity())
                    .state(l.getState())
                    .source(l.getSource() != null ? l.getSource() : "Direct")
                    .status(l.getStatus() != null ? l.getStatus() : "NEW")
                    .businessOutcome(l.getBusinessOutcome())
                    .interested(interested)
                    .convertedToSale(converted)
                    .notes(l.getAdditionalInfo())
                    .totalCallCount(l.getTotalCallCount() != null ? l.getTotalCallCount() : 0)
                    .connectedCallCount(l.getConnectedCallCount() != null ? l.getConnectedCallCount() : 0)
                    .missedCallCount(l.getMissedCallCount() != null ? l.getMissedCallCount() : 0)
                    .lastCallStatus(l.getLastCallStatus())
                    .nextFollowUpAt(formatDate(l.getNextFollowUpAt()))
                    .createdAt(formatDate(l.getCreatedAt()))
                    .updatedAt(formatDate(l.getUpdatedAt()))
                    .build());
        }
        return list;
    }

    private List<GoogleSheetsSyncPayload.AssignmentSyncItem> mapAssignments(List<LeadAssignment> assignments) {
        List<GoogleSheetsSyncPayload.AssignmentSyncItem> list = new ArrayList<>();
        for (LeadAssignment a : assignments) {
            list.add(GoogleSheetsSyncPayload.AssignmentSyncItem.builder()
                    .id(a.getId())
                    .leadId(a.getLead() != null ? a.getLead().getId() : null)
                    .leadName(a.getLead() != null ? a.getLead().getName() : "")
                    .assignedUserId(a.getUser() != null ? a.getUser().getId() : null)
                    .assignedUserName(a.getUser() != null ? a.getUser().getName() : "")
                    .assignedBy(a.getAssignedBy() != null ? a.getAssignedBy().getName() : "System")
                    .isActive(Boolean.TRUE.equals(a.getIsActive()))
                    .assignedAt(formatDate(a.getAssignedAt()))
                    .unassignedAt(formatDate(a.getUnassignedAt()))
                    .createdAt(formatDate(a.getAssignedAt()))
                    .build());
        }
        return list;
    }

    private List<GoogleSheetsSyncPayload.CallSyncItem> mapCalls(List<Call> calls) {
        List<GoogleSheetsSyncPayload.CallSyncItem> list = new ArrayList<>();
        for (Call c : calls) {
            list.add(GoogleSheetsSyncPayload.CallSyncItem.builder()
                    .id(c.getId())
                    .leadId(c.getLead() != null ? c.getLead().getId() : null)
                    .leadName(c.getLead() != null ? c.getLead().getName() : "")
                    .callerUserId(c.getUser() != null ? c.getUser().getId() : null)
                    .callerName(c.getUser() != null ? c.getUser().getName() : "")
                    .phoneNumber(c.getLead() != null ? c.getLead().getPhone() : (c.getPhoneNumber() != null ? c.getPhoneNumber() : ""))
                    .callDirection(c.getCallDirection() != null ? c.getCallDirection() : "OUTBOUND")
                    .callStatus(c.getCallStatus() != null ? c.getCallStatus() : "")
                    .startedAt(formatDate(c.getStartedAt()))
                    .endedAt(formatDate(c.getEndedAt()))
                    .durationSeconds(c.getDurationSeconds() != null ? c.getDurationSeconds() : 0)
                    .businessOutcome(c.getBusinessOutcome())
                    .notes(c.getNotes())
                    .followUpRequired(Boolean.TRUE.equals(c.getFollowUpRequired()))
                    .followUpDate(formatDate(c.getFollowUpDate()))
                    .createdAt(formatDate(c.getCreatedAt()))
                    .updatedAt(formatDate(c.getUpdatedAt()))
                    .build());
        }
        return list;
    }

    private List<GoogleSheetsSyncPayload.FollowUpSyncItem> mapFollowUps(List<FollowUp> followUps) {
        List<GoogleSheetsSyncPayload.FollowUpSyncItem> list = new ArrayList<>();
        for (FollowUp f : followUps) {
            list.add(GoogleSheetsSyncPayload.FollowUpSyncItem.builder()
                    .id(f.getId())
                    .leadId(f.getLead() != null ? f.getLead().getId() : null)
                    .leadName(f.getLead() != null ? f.getLead().getName() : "")
                    .assignedUser(f.getUser() != null ? f.getUser().getName() : "")
                    .callId(f.getCallId())
                    .followUpDate(formatDate(f.getScheduledTime()))
                    .status(f.getStatus() != null ? f.getStatus() : "PENDING")
                    .notes(f.getNotes())
                    .createdAt(formatDate(f.getCreatedAt()))
                    .completedAt(formatDate(f.getCompletedAt()))
                    .build());
        }
        return list;
    }

    private List<GoogleSheetsSyncPayload.SaleSyncItem> mapSales(List<Sale> sales) {
        List<GoogleSheetsSyncPayload.SaleSyncItem> list = new ArrayList<>();
        for (Sale s : sales) {
            list.add(GoogleSheetsSyncPayload.SaleSyncItem.builder()
                    .id(s.getId())
                    .leadId(s.getLead() != null ? s.getLead().getId() : null)
                    .leadName(s.getLead() != null ? s.getLead().getName() : "")
                    .assignedEmployee(s.getUser() != null ? s.getUser().getName() : "")
                    .conversionStatus("CONVERTED")
                    .conversionDate(formatDate(s.getConvertedAt()))
                    .dealValue(s.getDealValue())
                    .notes(s.getNotes())
                    .createdAt(formatDate(s.getCreatedAt()))
                    .build());
        }
        return list;
    }
}
