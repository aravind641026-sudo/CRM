$headers = @{
    "bypass-tunnel-reminder" = "true"
    "X-Sync-Secret" = "AKfycbzuicbaYTDeB1xFF925JE2JGp4Q6bETUuwNSCWHyNlApUTWEhhVPFXVKf7cWZc5IAbl"
    "Accept" = "application/json"
}

$res = Invoke-RestMethod -Uri "https://calling-crm-live-backend.loca.lt/api/v1/google-sheets/pull" -Method Post -Headers $headers
Write-Host "Success:" $res.data.success
Write-Host "Total Records:" $res.data.totalRecords
Write-Host "Tables Count:" ($res.data.tables.PSObject.Properties.Name.Count)
