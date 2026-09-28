$ErrorActionPreference = "Stop"

$baseUrl = "http://localhost:8080"
$secret = "AKfycbzuicbaYTDeB1xFF925JE2JGp4Q6bETUuwNSCWHyNlApUTWEhhVPFXVKf7cWZc5IAbl"

$headers = @{
    "Content-Type" = "application/json"
    "X-Sync-Secret" = $secret
    "Accept" = "application/json"
}

Write-Host "=========================================================="
Write-Host "TESTING GOOGLE SHEETS FULL DATABASE PUSH / PULL"
Write-Host "=========================================================="

$passCount = 0
$failCount = 0

function Assert-Test($condition, $testName, $detail) {
    if ($condition) {
        Write-Host "  [PASS] $testName : $detail" -ForegroundColor Green
        $global:passCount++
    } else {
        Write-Host "  [FAIL] $testName : $detail" -ForegroundColor Red
        $global:failCount++
    }
}

# -------------------------------------------------------------------------
# Test 1: PULL FROM DATABASE (Entire Database -> Sheets format)
# -------------------------------------------------------------------------
Write-Host "`n--- Test 1: PULL Database Snapshot ---"
$pullResponse = $null
try {
    $rawPull = Invoke-RestMethod -Uri "$baseUrl/api/v1/google-sheets/pull" -Method Post -Headers $headers
    $pullResponse = $rawPull.data
    Assert-Test ($pullResponse.success -eq $true) "Pull Success Flag" "Returned true"
    Assert-Test ($pullResponse.syncType -eq "PULL") "Pull Sync Type" "Got '$($pullResponse.syncType)'"
    Assert-Test ($pullResponse.totalRecords -gt 0) "Pull Record Count" "Total records: $($pullResponse.totalRecords)"
    
    $tables = $pullResponse.tables
    $tableNames = @("Roles", "Projects", "Users", "Leads", "Lead_Assignments", "Calls", "Follow_Ups", "Sales", "Notes", "Attendance", "Admin_Access_Requests")
    foreach ($t in $tableNames) {
        $hasTable = $tables.PSObject.Properties.Name -contains $t
        Assert-Test $hasTable "Table '$t' in Pull" "Found in response"
    }
} catch {
    Write-Host "Pull request failed: $_" -ForegroundColor Red
    $global:failCount++
}

# -------------------------------------------------------------------------
# Test 2: PUSH TO DATABASE (Successful Update with ID preservation)
# -------------------------------------------------------------------------
Write-Host "`n--- Test 2: PUSH Valid Modified Dataset ---"
try {
    # Convert pulled 2D arrays back into row objects for PUSH payload
    $pushTables = @{}
    
    foreach ($tableName in $pullResponse.tables.PSObject.Properties.Name) {
        $cols = $pullResponse.headers.$tableName
        $rows = $pullResponse.tables.$tableName
        $rowObjects = @()
        
        if ($rows) {
            foreach ($r in $rows) {
                $obj = @{}
                for ($c = 0; $c -lt $cols.Count; $c++) {
                    $colName = $cols[$c]
                    $val = $r[$c]
                    $obj[$colName] = $val
                }
                $rowObjects += $obj
            }
        }
        $pushTables[$tableName] = $rowObjects
    }

    # Modify Lead 29's additional_info
    $testNote = "Automated Test Note $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    $leadModified = $false
    foreach ($l in $pushTables["Leads"]) {
        if ($l["id"] -eq 29) {
            $l["additional_info"] = $testNote
            $leadModified = $true
            break
        }
    }

    $pushPayload = @{
        syncId = "TEST-PUSH-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        secret = $secret
        triggeredBy = "Admin (Automated Test)"
        tables = $pushTables
    } | ConvertTo-Json -Depth 10

    $rawPush = Invoke-RestMethod -Uri "$baseUrl/api/v1/google-sheets/push" -Method Post -Headers $headers -Body $pushPayload
    $pushData = $rawPush.data

    Assert-Test ($pushData.success -eq $true) "Push Success Flag" "Returned true"
    Assert-Test ($pushData.syncType -eq "PUSH") "Push Sync Type" "Got '$($pushData.syncType)'"
    Assert-Test ($pushData.totalRecords -gt 0) "Push Total Records Updated" "Updated count: $($pushData.totalRecords)"
    
    # Verify in DB via MySQL query that Lead 29 has updated additional_info
    $dbCheck = (mysql -u root -p2004 -e "SELECT additional_info FROM calling_crm.leads WHERE id = 29;" -N -s)
    Assert-Test ($dbCheck -like "*Automated Test Note*") "DB Lead 29 Updated In-Place" "DB note matches '$dbCheck'"

} catch {
    Write-Host "Push request failed: $_" -ForegroundColor Red
    $global:failCount++
}

# -------------------------------------------------------------------------
# Test 3: PUSH Validation - Invalid Foreign Key (Project ID 9999)
# -------------------------------------------------------------------------
Write-Host "`n--- Test 3: PUSH Validation - Invalid Foreign Key ---"
try {
    # Copy tables and set an invalid project_id on Lead 29
    $invalidFkTables = @{}
    foreach ($k in $pushTables.Keys) {
        $invalidFkTables[$k] = $pushTables[$k]
    }
    
    $brokenLeads = @()
    foreach ($l in $pushTables["Leads"]) {
        $copy = @{}
        foreach ($prop in $l.Keys) { $copy[$prop] = $l[$prop] }
        if ($copy["id"] -eq 29) {
            $copy["project_id"] = 9999  # Invalid project!
        }
        $brokenLeads += $copy
    }
    $invalidFkTables["Leads"] = $brokenLeads

    $badFkPayload = @{
        syncId = "TEST-BAD-FK"
        secret = $secret
        tables = $invalidFkTables
    } | ConvertTo-Json -Depth 10

    $failedAsExpected = $false
    try {
        Invoke-RestMethod -Uri "$baseUrl/api/v1/google-sheets/push" -Method Post -Headers $headers -Body $badFkPayload
    } catch {
        $failedAsExpected = $true
        $statusCode = $_.Exception.Response.StatusCode.value__
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $errBody = $reader.ReadToEnd()
        Write-Host "Test 3 Error Body: $errBody" -ForegroundColor Cyan
        Assert-Test ($statusCode -eq 400) "HTTP Status Code" "Got 400 Bad Request"
        Assert-Test ($errBody -like "*project_id*") "Identified Faulty Column" "Contained 'project_id'"
        Assert-Test ($errBody -like "*Project ID 9999 does not exist*") "Exact Error Reason" "Reported: Project ID 9999 does not exist"
        Assert-Test ($errBody -like "*ROLLED BACK*") "Rollback Confirmation" "Confirmed database changes rolled back"
    }
    Assert-Test $failedAsExpected "Rejected Invalid Foreign Key" "Server threw exception as expected"

} catch {
    Write-Host "Unexpected failure in test 3: $_" -ForegroundColor Red
    $global:failCount++
}

# -------------------------------------------------------------------------
# Test 4: PUSH Validation - Duplicate Primary Key
# -------------------------------------------------------------------------
Write-Host "`n--- Test 4: PUSH Validation - Duplicate Primary Key ---"
try {
    $dupKeyTables = @{}
    foreach ($k in $pushTables.Keys) { $dupKeyTables[$k] = $pushTables[$k] }
    
    # Duplicate a user row
    $dupUsers = @()
    foreach ($u in $pushTables["Users"]) { $dupUsers += $u }
    if ($dupUsers.Count -gt 0) {
        $cloned = @{}
        foreach ($k in $dupUsers[0].Keys) { $cloned[$k] = $dupUsers[0][$k] }
        $cloned["email"] = "unique_email_dup_id@crm.com" # Different email, identical ID!
        $dupUsers += $cloned
    }
    $dupKeyTables["Users"] = $dupUsers

    $dupPayload = @{
        syncId = "TEST-DUP-ID"
        secret = $secret
        tables = $dupKeyTables
    } | ConvertTo-Json -Depth 10

    $dupRejected = $false
    try {
        Invoke-RestMethod -Uri "$baseUrl/api/v1/google-sheets/push" -Method Post -Headers $headers -Body $dupPayload
    } catch {
        $dupRejected = $true
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $errBody = $reader.ReadToEnd()
        Write-Host "Test 4 Error Body: $errBody" -ForegroundColor Cyan
        Assert-Test ($errBody -like "*Duplicate primary key ID*") "Duplicate Primary Key Message" "Reported duplicate ID in Users"
    }
    Assert-Test $dupRejected "Rejected Duplicate Primary Key" "Server threw validation exception"

} catch {
    Write-Host "Unexpected failure in test 4: $_" -ForegroundColor Red
    $global:failCount++
}

# -------------------------------------------------------------------------
# Test 5: SYNC STATUS ENDPOINT
# -------------------------------------------------------------------------
Write-Host "`n--- Test 5: SYNC STATUS Endpoint ---"
try {
    $rawStatus = Invoke-RestMethod -Uri "$baseUrl/api/v1/google-sheets/status" -Method Get -Headers $headers
    $statusData = $rawStatus.data
    Assert-Test ($statusData -ne $null) "Status Response Present" "Got status object"
    Assert-Test ($statusData.status -ne $null) "Status Field Populated" "Status: $($statusData.status)"
    Assert-Test ($statusData.recordsSynced -gt 0) "Records Synced Counter" "Records: $($statusData.recordsSynced)"
} catch {
    Write-Host "Status check failed: $_" -ForegroundColor Red
    $global:failCount++
}

Write-Host "`n=========================================================="
Write-Host "FULL DATABASE PUSH / PULL TEST SUMMARY: $passCount Passed, $failCount Failed"
Write-Host "=========================================================="

if ($failCount -gt 0) {
    exit 1
} else {
    exit 0
}
