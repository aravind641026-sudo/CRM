/**
 * =========================================================================================
 * CALLING CRM — FULL DATABASE PUSH / PULL GOOGLE SHEETS CONTROL ENGINE
 * =========================================================================================
 * 
 * ARCHITECTURE:
 *   Google Sheet (Master Control Interface)
 *     ↕ (HTTPS via Google Apps Script)
 *   Spring Boot Backend (/api/v1/google-sheets/pull & /push)
 *     ↕
 *   MySQL Database
 * 
 * FEATURES:
 * 1. PUSH TO DATABASE: Full Sheet -> Validation -> Transaction -> MySQL DB
 * 2. PULL FROM DATABASE: Full MySQL DB -> Batch 2D Arrays -> Google Sheet
 * 3. Master Control Tab: CRM_SYNC_CONTROL
 * 4. Audit Trail Tab: Sync_Log
 * 5. Full Entity Tabs: Roles, Projects, Users, Leads, Lead_Assignments, Calls, Follow_Ups,
 *                      Sales, Notes, Attendance, Admin_Access_Requests, Audit_Logs
 * =========================================================================================
 */

// Configuration
var CONFIG = {
  // Live Public Backend URL for Google Sheets cloud integration
  DEFAULT_BACKEND_URL: "https://procedures-anderson-importance-drivers.trycloudflare.com",
  
  // Shared secret for admin authentication with Spring Boot
  DEFAULT_SECRET: "AKfycbzuicbaYTDeB1xFF925JE2JGp4Q6bETUuwNSCWHyNlApUTWEhhVPFXVKf7cWZc5IAbl",
  
  TIMEZONE: "Asia/Kolkata",
  DATE_FORMAT: "dd-MM-yyyy HH:mm:ss",
  
  // Styling tokens
  HEADER_BG_COLOR: "#1E293B",     // Slate-800
  HEADER_FONT_COLOR: "#FFFFFF",
  CONTROL_BG_COLOR: "#0F172A",    // Slate-900
  CONTROL_TEXT_COLOR: "#38BDF8",  // Sky-400
  BORDER_COLOR: "#E2E8F0"
};

/**
 * Creates custom CRM SYNC menu on spreadsheet open
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("CRM SYNC")
    .addItem("⬆️ PUSH TO DATABASE", "pushToDatabase")
    .addItem("⬇️ PULL FROM DATABASE", "pullFromDatabase")
    .addSeparator()
    .addItem("🧹 CLEAN DUPLICATE TABS", "cleanDuplicateTabs")
    .addItem("📊 SYNC STATUS", "getSyncStatus")
    .addSeparator()
    .addItem("⚙️ CONFIGURE CONNECTION", "configureConnection")
    .addItem("🔄 RESET CONNECTION TO DEFAULT", "resetConnection")
    .addToUi();
}

/**
 * =========================================================================================
 * 1. PUSH TO DATABASE (Google Sheet -> Spring Boot -> Entire MySQL Database)
 * =========================================================================================
 */
function pushToDatabase() {
  var ui = SpreadsheetApp.getUi();
  
  // 1. Mandatory Confirmation Dialog
  var confirm = ui.alert(
    "CONFIRM DATABASE PUSH",
    "WARNING:\n" +
    "This will synchronize the complete Google Sheet data with the CRM database.\n\n" +
    "Existing database records may be updated. If validation fails, changes will be completely rolled back.\n\n" +
    "Do you want to continue?",
    ui.ButtonSet.YES_NO
  );
  
  if (confirm !== ui.Button.YES) {
    ui.alert("Push cancelled by user.");
    return;
  }

  // 2. Concurrency Lock
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    ui.alert("⚠️ Another synchronization operation is currently in progress. Please wait.");
    return;
  }

  var startTime = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, CONFIG.DATE_FORMAT);
  var syncCode = "PUSH-" + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyyMMdd-HHmmss");
  var ss = getSpreadsheet();

  try {
    // 3. Read all relevant application table tabs
    var tablesToSync = [
      "Roles", "Projects", "Users", "Leads", "Lead_Assignments",
      "Calls", "Follow_Ups", "Sales", "Notes", "Attendance",
      "Shift_Change_Requests", "Admin_Access_Requests"
    ];

    var tablesPayload = {};
    var totalRowsCount = 0;

    for (var i = 0; i < tablesToSync.length; i++) {
      var tabName = tablesToSync[i];
      var sheet = ss.getSheetByName(tabName);
      if (!sheet) continue;

      var data = sheet.getDataRange().getValues();
      if (!data || data.length <= 1) {
        tablesPayload[tabName] = [];
        continue;
      }

      var headers = data[0];
      var rowObjects = [];

      for (var r = 1; r < data.length; r++) {
        var row = data[r];
        // Skip completely empty rows
        var hasContent = false;
        for (var c = 0; c < row.length; c++) {
          var cellStr = (row[c] !== null && row[c] !== undefined) ? String(row[c]).trim() : "";
          if (cellStr !== "" && cellStr !== "null") {
            hasContent = true;
            break;
          }
        }
        if (!hasContent) continue;

        var obj = {};
        for (var h = 0; h < headers.length; h++) {
          var headerKey = String(headers[h]).trim();
          var val = row[h];
          if (val instanceof Date) {
            val = Utilities.formatDate(val, CONFIG.TIMEZONE, CONFIG.DATE_FORMAT);
          }
          obj[headerKey] = val;
        }
        rowObjects.push(obj);
      }

      tablesPayload[tabName] = rowObjects;
      totalRowsCount += rowObjects.length;
    }

    // 4. Send Payload to Spring Boot Backend API
    var backendUrl = getBackendUrl();
    var secret = getSecret();
    var endpoint = backendUrl + "/api/v1/google-sheets/push";

    var requestPayload = {
      syncId: syncCode,
      secret: secret,
      triggeredBy: Session.getActiveUser().getEmail() || "Admin (Sheets)",
      tables: tablesPayload
    };

    var options = {
      method: "post",
      contentType: "application/json; charset=UTF-8",
      headers: {
        "X-Sync-Secret": secret,
        "Accept": "application/json",
        "bypass-tunnel-reminder": "true"
      },
      payload: JSON.stringify(requestPayload),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(endpoint, options);
    var statusCode = response.getResponseCode();
    var responseText = response.getContentText();
    var responseJson = null;

    try {
      responseJson = JSON.parse(responseText);
    } catch (parseErr) {}

    var completedTime = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, CONFIG.DATE_FORMAT);

    if (statusCode >= 200 && statusCode < 300) {
      var dataObj = (responseJson && responseJson.data) ? responseJson.data : responseJson;
      var updatedCount = dataObj ? dataObj.totalRecords : totalRowsCount;

      // Update Sync_Log
      logSyncRun(ss, {
        syncId: syncCode,
        syncType: "PUSH",
        startedAt: startTime,
        completedAt: completedTime,
        status: "SUCCESS",
        tablesProcessed: Object.keys(tablesPayload).length,
        totalRecords: updatedCount,
        errorMessage: "-",
        triggeredBy: Session.getActiveUser().getEmail() || "Admin"
      });

      // Update Control Panel
      updateControlPanel(ss, {
        lastPush: completedTime,
        status: "SUCCESS",
        message: "Database synchronized successfully (" + updatedCount + " records updated)."
      });

      ui.alert(
        "✅ PUSH COMPLETED SUCCESSFULLY",
        "CRM Database has been synchronized with the latest Google Sheet data.\n\n" +
        "Sync ID: " + syncCode + "\n" +
        "Total Records Updated: " + updatedCount + "\n" +
        "Status: SUCCESS",
        ui.ButtonSet.OK
      );

    } else {
      // Failure Handling
      var errorMsg = "HTTP " + statusCode;
      if (responseJson) {
        errorMsg = responseJson.message || responseJson.error || responseText;
      }

      // Update Sync_Log
      logSyncRun(ss, {
        syncId: syncCode,
        syncType: "PUSH",
        startedAt: startTime,
        completedAt: completedTime,
        status: "FAILED",
        tablesProcessed: Object.keys(tablesPayload).length,
        totalRecords: 0,
        errorMessage: errorMsg,
        triggeredBy: Session.getActiveUser().getEmail() || "Admin"
      });

      // Update Control Panel
      updateControlPanel(ss, {
        lastPush: completedTime,
        status: "FAILED",
        message: "PUSH FAILED: " + errorMsg
      });

      ui.alert(
        "❌ PUSH FAILED",
        errorMsg + "\n\nDatabase changes have been ROLLED BACK.",
        ui.ButtonSet.OK
      );
    }

  } catch (err) {
    var failTime = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, CONFIG.DATE_FORMAT);
    updateControlPanel(ss, {
      lastPush: failTime,
      status: "FAILED",
      message: "PUSH ERROR: " + err.message
    });
    ui.alert("❌ PUSH ERROR", err.message, ui.ButtonSet.OK);
  } finally {
    lock.releaseLock();
  }
}

/**
 * =========================================================================================
 * 2. PULL FROM DATABASE (Entire Database -> Spring Boot -> Google Sheet)
 * =========================================================================================
 */
function pullFromDatabase() {
  var ui = SpreadsheetApp.getUi();

  // 1. Mandatory Confirmation Dialog
  var confirm = ui.alert(
    "CONFIRM DATABASE PULL",
    "This will replace the current Google Sheet data with the complete current CRM database snapshot.\n\n" +
    "Do you want to continue?",
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) {
    ui.alert("Pull cancelled by user.");
    return;
  }

  // 2. Concurrency Lock
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    ui.alert("⚠️ Another synchronization operation is currently in progress. Please wait.");
    return;
  }

  var startTime = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, CONFIG.DATE_FORMAT);
  var ss = getSpreadsheet();

  try {
    var backendUrl = getBackendUrl();
    var secret = getSecret();
    var endpoint = backendUrl + "/api/v1/google-sheets/pull";

    var options = {
      method: "post",
      contentType: "application/json; charset=UTF-8",
      headers: {
        "X-Sync-Secret": secret,
        "Accept": "application/json",
        "bypass-tunnel-reminder": "true"
      },
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(endpoint, options);
    var statusCode = response.getResponseCode();
    var responseText = response.getContentText();
    var responseJson = null;

    try {
      responseJson = JSON.parse(responseText);
    } catch (parseErr) {}

    var completedTime = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, CONFIG.DATE_FORMAT);

    if (statusCode >= 200 && statusCode < 300) {
      var pullData = (responseJson && responseJson.data) ? responseJson.data : responseJson;
      var tablesMap = pullData.tables || {};
      var headersMap = pullData.headers || {};
      var syncCode = pullData.syncId || ("PULL-" + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyyMMdd-HHmmss"));
      var totalRecords = pullData.totalRecords || 0;

      // Batch Write Every Table to its respective Worksheet Tab
      for (var tableName in tablesMap) {
        var headers = headersMap[tableName] || [];
        var rows = tablesMap[tableName] || [];
        writeTableSheet(ss, tableName, headers, rows);
      }

      // Purge any duplicate or stray tabs (e.g. Sheet1, Lead_Assignments_2, etc.)
      purgeRedundantSheets(ss, Object.keys(tablesMap));

      // Update Sync_Log
      logSyncRun(ss, {
        syncId: syncCode,
        syncType: "PULL",
        startedAt: startTime,
        completedAt: completedTime,
        status: "SUCCESS",
        tablesProcessed: Object.keys(tablesMap).length,
        totalRecords: totalRecords,
        errorMessage: "-",
        triggeredBy: Session.getActiveUser().getEmail() || "Admin"
      });

      // Update Control Panel
      updateControlPanel(ss, {
        lastPull: completedTime,
        status: "SUCCESS",
        message: "Database snapshot pulled successfully (" + totalRecords + " records)."
      });

      ui.alert(
        "✅ PULL COMPLETED SUCCESSFULLY",
        "Google Sheets has been updated with the complete database snapshot.\n\n" +
        "Sync ID: " + syncCode + "\n" +
        "Total Tables: " + Object.keys(tablesMap).length + "\n" +
        "Total Records: " + totalRecords,
        ui.ButtonSet.OK
      );

    } else {
      var errorMsg = "HTTP " + statusCode;
      if (responseJson) {
        errorMsg = responseJson.message || responseJson.error || responseText;
      }

      logSyncRun(ss, {
        syncId: "PULL-ERR",
        syncType: "PULL",
        startedAt: startTime,
        completedAt: completedTime,
        status: "FAILED",
        tablesProcessed: 0,
        totalRecords: 0,
        errorMessage: errorMsg,
        triggeredBy: Session.getActiveUser().getEmail() || "Admin"
      });

      updateControlPanel(ss, {
        lastPull: completedTime,
        status: "FAILED",
        message: "PULL FAILED: " + errorMsg
      });

      ui.alert(
        "❌ PULL FAILED (HTTP " + statusCode + ")",
        "Target URL: " + backendUrl + "\n\n" +
        "Details: " + errorMsg + "\n\n" +
        "👉 To update or verify your active connection URL, use:\n" +
        "CRM SYNC > ⚙️ CONFIGURE CONNECTION",
        ui.ButtonSet.OK
      );
    }

  } catch (err) {
    var failTime = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, CONFIG.DATE_FORMAT);
    updateControlPanel(ss, {
      lastPull: failTime,
      status: "FAILED",
      message: "PULL ERROR: " + err.message
    });
    ui.alert("❌ PULL ERROR", err.message, ui.ButtonSet.OK);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Writes data rows to a sheet in a single 2D batch operation
 */
function writeTableSheet(ss, sheetName, headers, rows) {
  var sheet = getOrCreateSheet(ss, sheetName, headers);

  // Clear existing data rows (keep header row 1)
  var lastRow = sheet.getLastRow();
  var maxCols = Math.max(headers.length, sheet.getLastColumn(), 1);
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, maxCols).clearContent().clearFormat();
  }

  // Ensure headers match exactly
  if (headers && headers.length > 0) {
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setBackground(CONFIG.HEADER_BG_COLOR)
               .setFontColor(CONFIG.HEADER_FONT_COLOR)
               .setFontWeight("bold")
               .setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
  }

  if (rows && rows.length > 0) {
    // Sanitize rows ensuring row width matches headers.length
    var cleanRows = [];
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var cleanRow = [];
      for (var c = 0; c < headers.length; c++) {
        var v = (row && c < row.length) ? row[c] : "";
        cleanRow.push(v !== null && v !== undefined ? v : "");
      }
      cleanRows.push(cleanRow);
    }

    var dataRange = sheet.getRange(2, 1, cleanRows.length, headers.length);
    dataRange.setValues(cleanRows);

    // Apply alternate zebra row backgrounds in single batch
    var backgrounds = [];
    for (var i = 0; i < cleanRows.length; i++) {
      var bg = (i % 2 === 1) ? "#F8FAFC" : "#FFFFFF";
      var rowBgs = [];
      for (var j = 0; j < headers.length; j++) rowBgs.push(bg);
      backgrounds.push(rowBgs);
    }
    dataRange.setBackgrounds(backgrounds);
  }
}

/**
 * =========================================================================================
 * 3. CONTROL PANEL TAB (CRM_SYNC_CONTROL)
 * =========================================================================================
 */
function updateControlPanel(ss, info) {
  var sheet = ss.getSheetByName("CRM_SYNC_CONTROL");
  if (!sheet) {
    sheet = ss.insertSheet("CRM_SYNC_CONTROL", 0);
  }

  // Build styled dashboard
  sheet.setColumnWidth(1, 40);
  sheet.setColumnWidth(2, 220);
  sheet.setColumnWidth(3, 400);

  // Title Banner
  sheet.getRange("B2:C2").merge()
       .setValue("🚀 CALLING CRM — MASTER DATABASE SYNC CONTROL")
       .setBackground("#0F172A")
       .setFontColor("#38BDF8")
       .setFontWeight("bold")
       .setFontSize(14)
       .setHorizontalAlignment("center")
       .setVerticalAlignment("middle");

  sheet.setRowHeight(2, 45);

  var currentPush = info.lastPush || sheet.getRange("C4").getValue() || "Never";
  var currentPull = info.lastPull || sheet.getRange("C5").getValue() || "Never";
  var status = info.status || "IDLE";
  var msg = info.message || "Ready for synchronization";
  var statusColor = (status === "SUCCESS") ? "#16A34A" : (status === "FAILED" ? "#DC2626" : "#E2E8F0");

  var fields = [
    ["Last Push (Sheet → DB):", currentPush],
    ["Last Pull (DB → Sheet):", currentPull],
    ["Last Sync Status:", status],
    ["Last Sync Message:", msg],
    ["Backend API Endpoint:", getBackendUrl()],
    ["Managed Tables:", "Roles, Projects, Users, Leads, Lead_Assignments, Calls, Follow_Ups, Sales, Notes, Attendance, Admin_Access_Requests"]
  ];

  for (var i = 0; i < fields.length; i++) {
    var rowIdx = i + 4;
    sheet.getRange(rowIdx, 2).setValue(fields[i][0]).setFontWeight("bold").setBackground("#F1F5F9");
    var valCell = sheet.getRange(rowIdx, 3);
    valCell.setValue(fields[i][1]);
    if (fields[i][0] === "Last Sync Status:") {
      valCell.setFontWeight("bold").setFontColor(statusColor);
    }
  }

  // Instructions
  sheet.getRange("B11:C11").merge()
       .setValue("📋 HOW TO USE:\n• Use the 'CRM SYNC' menu at the top of the screen to PUSH or PULL.\n• PUSH: Google Sheet data replaces/updates the CRM database with full validation.\n• PULL: Exports the full database snapshot into this spreadsheet.")
       .setBackground("#F8FAFC")
       .setFontColor("#334155")
       .setFontSize(10)
       .setWrap(true);
}

/**
 * Appends an entry into the Sync_Log tab
 */
function logSyncRun(ss, logData) {
  var headers = [
    "sync_id", "sync_type", "started_at", "completed_at", "status",
    "tables_processed", "total_records", "error_message", "triggered_by"
  ];
  var sheet = getOrCreateSheet(ss, "Sync_Log", headers);
  sheet.appendRow([
    logData.syncId || "",
    logData.syncType || "",
    logData.startedAt || "",
    logData.completedAt || "",
    logData.status || "",
    logData.tablesProcessed || 0,
    logData.totalRecords || 0,
    logData.errorMessage || "-",
    logData.triggeredBy || ""
  ]);
}

/**
 * =========================================================================================
 * 4. SYNC STATUS & CONFIGURATION
 * =========================================================================================
 */
function getSyncStatus() {
  var ui = SpreadsheetApp.getUi();
  try {
    var backendUrl = getBackendUrl();
    var secret = getSecret();
    var endpoint = backendUrl + "/api/v1/google-sheets/status";

    var options = {
      method: "get",
      headers: {
        "X-Sync-Secret": secret,
        "Accept": "application/json",
        "bypass-tunnel-reminder": "true"
      },
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(endpoint, options);
    var json = JSON.parse(response.getContentText());
    var data = json.data || json;

    ui.alert(
      "📊 CRM DATABASE SYNC STATUS",
      "Sync Code: " + (data.syncCode || "N/A") + "\n" +
      "Status: " + (data.status || "N/A") + "\n" +
      "Total Records: " + (data.recordsSynced || 0) + "\n" +
      "Triggered By: " + (data.triggeredBy || "Admin") + "\n" +
      "Last Synced: " + (data.completedAt || "Never") + "\n" +
      "Message: " + (data.message || "N/A"),
      ui.ButtonSet.OK
    );
  } catch (err) {
    ui.alert("⚠️ Status Check Failed", err.message, ui.ButtonSet.OK);
  }
}

function configureConnection() {
  var ui = SpreadsheetApp.getUi();
  var currentUrl = getBackendUrl();
  
  var urlPrompt = ui.prompt(
    "Configure Backend API URL",
    "Enter the Spring Boot Backend URL (Leave blank to use default: " + CONFIG.DEFAULT_BACKEND_URL + "):\n\nCurrent: " + currentUrl,
    ui.ButtonSet.OK_CANCEL
  );

  if (urlPrompt.getSelectedButton() === ui.Button.OK) {
    var newUrl = urlPrompt.getResponseText().trim();
    if (!newUrl) {
      newUrl = CONFIG.DEFAULT_BACKEND_URL;
    }
    if (newUrl.endsWith("/")) newUrl = newUrl.substring(0, newUrl.length - 1);
    PropertiesService.getScriptProperties().setProperty("BACKEND_URL", newUrl);
    var ss = getSpreadsheet();
    updateControlPanel(ss, { message: "Backend URL updated to: " + newUrl });
    ui.alert("✅ Backend URL updated to: " + newUrl);
  }
}

function resetConnection() {
  var ui = SpreadsheetApp.getUi();
  PropertiesService.getScriptProperties().setProperty("BACKEND_URL", CONFIG.DEFAULT_BACKEND_URL);
  var ss = getSpreadsheet();
  updateControlPanel(ss, { message: "Connection reset to default: " + CONFIG.DEFAULT_BACKEND_URL });
  ui.alert("🔄 RESET SUCCESSFUL", "Backend URL has been reset to active default:\n" + CONFIG.DEFAULT_BACKEND_URL, ui.ButtonSet.OK);
}

/**
 * Clean up duplicate/stray sheets (e.g. Sheet1, Lead_Assignments_2, Leads_Copy, etc.)
 */
function cleanDuplicateTabs() {
  var ui = SpreadsheetApp.getUi();
  var ss = getSpreadsheet();
  var allowedTabs = [
    "CRM_SYNC_CONTROL", "Sync_Log",
    "Roles", "Projects", "Users", "Leads", "Lead_Assignments",
    "Calls", "Follow_Ups", "Sales", "Notes", "Attendance",
    "Shift_Change_Requests", "Admin_Access_Requests", "Audit_Logs"
  ];

  var deletedTabs = purgeRedundantSheets(ss, allowedTabs);
  if (deletedTabs.length > 0) {
    ui.alert("🧹 CLEANUP COMPLETE", "Removed " + deletedTabs.length + " redundant tab(s):\n• " + deletedTabs.join("\n• "), ui.ButtonSet.OK);
  } else {
    ui.alert("✅ CLEAN", "No duplicate or redundant tabs found. Your Google Sheet matches MySQL 1-to-1.", ui.ButtonSet.OK);
  }
}

/**
 * Purges sheets that do not belong to the canonical MySQL backup table list
 */
function purgeRedundantSheets(ss, canonicalNames) {
  var allowedSet = {};
  allowedSet["CRM_SYNC_CONTROL"] = true;
  allowedSet["Sync_Log"] = true;
  for (var i = 0; i < canonicalNames.length; i++) {
    allowedSet[canonicalNames[i]] = true;
  }

  var sheets = ss.getSheets();
  var deleted = [];

  // Need at least 1 sheet to remain open
  if (sheets.length <= 1) return deleted;

  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s];
    var sName = sh.getName();
    if (!allowedSet[sName]) {
      // Check if it's a default/duplicate sheet like Sheet1, Lead_Assignments_2, etc.
      if (sheets.length > 1) {
        try {
          ss.deleteSheet(sh);
          deleted.push(sName);
        } catch (e) {}
      }
    }
  }
  return deleted;
}

/**
 * Backward compatibility: Web App POST webhook when triggered from web admin panel
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, message: "No payload received" }, 400);
    }

    var payload = JSON.parse(e.postData.contents);
    var clientSecret = payload.secret;
    var configuredSecret = getSecret();

    if (!clientSecret || clientSecret !== configuredSecret) {
      return jsonResponse({ success: false, message: "Unauthorized" }, 401);
    }

    // Ping check
    if (payload.action === "ping") {
      return jsonResponse({ success: true, message: "Calling CRM Google Apps Script endpoint is healthy." });
    }

    var ss = getSpreadsheet();
    var nowStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, CONFIG.DATE_FORMAT);

    // Sync individual tables if provided in legacy payload
    if (payload.users) writeTableSheet(ss, "Users", ["id", "name", "email", "phone", "role", "status", "created_at", "updated_at"], payload.users.map(function(u) { return [u.id, u.name, u.email, u.phone, u.role, u.status, u.createdAt, u.updatedAt]; }));
    if (payload.projects) writeTableSheet(ss, "Projects", ["id", "name", "description", "status", "created_by", "created_at", "updated_at"], payload.projects.map(function(p) { return [p.id, p.name, p.description, p.status, p.createdBy, p.createdAt, p.updatedAt]; }));
    if (payload.leads) writeTableSheet(ss, "Leads", ["id", "project_id", "project_name", "name", "phone", "email", "city", "status", "business_outcome", "created_at"], payload.leads.map(function(l) { return [l.id, l.projectId, l.projectName, l.name, l.phone, l.email, l.city, l.status, l.businessOutcome, l.createdAt]; }));
    if (payload.calls) writeTableSheet(ss, "Calls", ["id", "lead_id", "lead_name", "caller_user_id", "caller_name", "phone_number", "call_direction", "call_status", "duration_seconds", "created_at"], payload.calls.map(function(c) { return [c.id, c.leadId, c.leadName, c.callerUserId, c.callerName, c.phoneNumber, c.callDirection, c.callStatus, c.durationSeconds, c.createdAt]; }));

    updateControlPanel(ss, { lastPull: nowStr, status: "SUCCESS", message: "Web-triggered sync completed." });

    return jsonResponse({ success: true, message: "CRM data synchronized successfully", syncedAt: nowStr });
  } catch (err) {
    return jsonResponse({ success: false, message: err.message }, 500);
  } finally {
    lock.releaseLock();
  }
}

// Helpers
function getBackendUrl() {
  var savedUrl = PropertiesService.getScriptProperties().getProperty("BACKEND_URL");
  var url = (savedUrl && savedUrl.trim() !== "") ? savedUrl.trim() : CONFIG.DEFAULT_BACKEND_URL;
  // Automatically clear old/expired tunnel domains
  if (savedUrl && (
      savedUrl.indexOf("instructor-davis-mods-scenario") !== -1 ||
      savedUrl.indexOf("chilly-wolves-post") !== -1 ||
      savedUrl.indexOf("petite-fans-send") !== -1 ||
      savedUrl.indexOf("odd-tables-rhyme") !== -1 ||
      savedUrl.indexOf("evil-tools-allow") !== -1 ||
      (savedUrl.indexOf("trycloudflare.com") !== -1 && savedUrl !== CONFIG.DEFAULT_BACKEND_URL)
  )) {
    url = CONFIG.DEFAULT_BACKEND_URL;
    PropertiesService.getScriptProperties().setProperty("BACKEND_URL", url);
  }
  if (!url || url.indexOf("localhost") !== -1 || url.indexOf("127.0.0.1") !== -1) {
    throw new Error(
      "Cannot use 'localhost' from Google Sheets.\n\n" +
      "Google Apps Script runs in Google Cloud servers and cannot reach your computer's local port directly.\n\n" +
      "👉 TO FIX:\n" +
      "1. Use the active public URL: " + CONFIG.DEFAULT_BACKEND_URL + "\n" +
      "2. In Google Sheets menu, click: CRM SYNC > ⚙️ CONFIGURE CONNECTION and paste it."
    );
  }
  return url;
}

function getSecret() {
  return PropertiesService.getScriptProperties().getProperty("SHARED_SECRET") || CONFIG.DEFAULT_SECRET;
}

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getOrCreateSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  if (headers && headers.length > 0 && sheet.getLastRow() === 0) {
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setBackground(CONFIG.HEADER_BG_COLOR)
               .setFontColor(CONFIG.HEADER_FONT_COLOR)
               .setFontWeight("bold")
               .setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonResponse(obj, optStatusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
