package com.crm.service;

import com.crm.dto.request.GoogleSheetsSyncPayload;
import com.crm.exception.GoogleSheetsSyncException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

@Slf4j
@Component
public class GoogleAppsScriptClient {

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Value("${app.google-sheets.apps-script-url:https://script.google.com/macros/s/AKfycbzuicbaYTDeB1xFF925JE2JGp4Q6bETUuwNSCWHyNlApUTWEhhVPFXVKf7cWZc5IAbl/exec}")
    private String appsScriptUrl;

    @Value("${app.google-sheets.shared-secret:AKfycbzuicbaYTDeB1xFF925JE2JGp4Q6bETUuwNSCWHyNlApUTWEhhVPFXVKf7cWZc5IAbl}")
    private String sharedSecret;

    @Value("${app.google-sheets.connect-timeout-ms:10000}")
    private long connectTimeoutMs;

    @Value("${app.google-sheets.read-timeout-ms:60000}")
    private long readTimeoutMs;

    @Value("${app.google-sheets.max-retries:2}")
    private int maxRetries;

    @Value("${app.google-sheets.mock-mode:false}")
    private boolean mockMode;

    public GoogleAppsScriptClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.ALWAYS)
                .connectTimeout(Duration.ofMillis(10000))
                .build();
    }

    /**
     * Sends the complete CRM dataset to the Google Apps Script Web App.
     * Includes automatic 302 redirect following and retry on transient network drops.
     */
    public JsonNode sendSyncPayload(GoogleSheetsSyncPayload payload) {
        if (mockMode) {
            log.info("GoogleAppsScriptClient is in MOCK MODE for automated testing.");
            return objectMapper.createObjectNode()
                    .put("success", true)
                    .put("message", "CRM data synchronized successfully (mock)")
                    .put("syncedAt", "2026-09-21T10:30:00");
        }

        // Guarantee secret is present in payload and headers
        payload.setSecret(sharedSecret);

        String requestJson;
        try {
            requestJson = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            throw new GoogleSheetsSyncException("Failed to serialize synchronization payload to JSON", e);
        }

        int attempts = 0;
        Exception lastException = null;

        while (attempts <= maxRetries) {
            attempts++;
            try {
                log.info("Sending sync payload to Google Apps Script [Attempt {}/{}, size ~{} bytes]...",
                        attempts, maxRetries + 1, requestJson.length());

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(appsScriptUrl))
                        .timeout(Duration.ofMillis(readTimeoutMs))
                        .header("Content-Type", "application/json; charset=UTF-8")
                        .header("Accept", "application/json")
                        .header("X-Sync-Secret", sharedSecret)
                        .POST(HttpRequest.BodyPublishers.ofString(requestJson, StandardCharsets.UTF_8))
                        .build();

                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
                int statusCode = response.statusCode();
                String responseBody = response.body();

                log.info("Received Google Apps Script response: HTTP {} (body length: {})", statusCode,
                        responseBody != null ? responseBody.length() : 0);

                if (statusCode == 401 || statusCode == 403) {
                    if (responseBody != null && (responseBody.contains("<html") || responseBody.contains("<!DOCTYPE") || responseBody.contains("accounts.google.com"))) {
                        throw new GoogleSheetsSyncException("Google Apps Script rejected access (HTTP " + statusCode + "). " +
                                "In Google Apps Script, ensure your Web App is deployed with 'Execute as: Me' and 'Who has access: Anyone'.");
                    }
                    throw new GoogleSheetsSyncException("Apps Script authentication rejected (HTTP " + statusCode + "). Please check your shared secret.");
                }

                if (statusCode >= 200 && statusCode < 300) {
                    try {
                        JsonNode json = objectMapper.readTree(responseBody);
                        boolean success = json.path("success").asBoolean(false);
                        if (!success) {
                            String errorMsg = json.path("message").asText("Apps Script reported failure");
                            throw new GoogleSheetsSyncException("Google Sheets update failed: " + errorMsg);
                        }
                        return json;
                    } catch (Exception jsonErr) {
                        // Sometimes Google returns HTML error page (e.g. sign in or function not found)
                        if (responseBody != null && responseBody.contains("<html")) {
                            if (responseBody.contains("Script function not found")) {
                                throw new GoogleSheetsSyncException("Google Apps Script reported: 'Script function not found: doPost'. " +
                                        "In Google Apps Script: paste the code from google-apps-script/Code.gs, click Save, then Deploy > Manage deployments > Edit > select 'New version' and click Deploy.");
                            }
                            throw new GoogleSheetsSyncException("Received HTML instead of JSON from Google Apps Script. Ensure your script is deployed as a Web App with access set to 'Anyone'.");
                        }
                        throw new GoogleSheetsSyncException("Failed to parse Google Apps Script JSON response: " + jsonErr.getMessage(), jsonErr);
                    }
                }

                // If 5xx server error, may retry
                if (statusCode >= 500 && attempts <= maxRetries) {
                    log.warn("Google Apps Script returned server error HTTP {}. Retrying in 2 seconds...", statusCode);
                    Thread.sleep(2000);
                    continue;
                }

                throw new GoogleSheetsSyncException("Google Apps Script returned HTTP status " + statusCode + ": " + responseBody);

            } catch (GoogleSheetsSyncException ge) {
                // Non-retryable business/auth exception
                throw ge;
            } catch (IOException | InterruptedException e) {
                lastException = e;
                if (e instanceof InterruptedException) {
                    Thread.currentThread().interrupt();
                    throw new GoogleSheetsSyncException("Synchronization was interrupted", e);
                }
                log.warn("Network error during Apps Script synchronization (attempt {}/{}): {}", attempts, maxRetries + 1, e.getMessage());
                if (attempts <= maxRetries) {
                    try {
                        Thread.sleep(2000L * attempts);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new GoogleSheetsSyncException("Synchronization retry was interrupted", ie);
                    }
                }
            }
        }

        throw new GoogleSheetsSyncException("Google Sheets synchronization failed after " + attempts + " attempts: " +
                (lastException != null ? lastException.getMessage() : "Unknown network failure"), lastException);
    }
}
