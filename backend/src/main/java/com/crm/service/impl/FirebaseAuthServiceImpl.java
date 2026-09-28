package com.crm.service.impl;

import com.crm.service.FirebaseAuthService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.UserRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

@Service
public class FirebaseAuthServiceImpl implements FirebaseAuthService {

    private static final Logger logger = LoggerFactory.getLogger(FirebaseAuthServiceImpl.class);

    @Value("${firebase.web-api-key:AIzaSyBFXGeQ0OytxoSKwgj8o1gdf7m7O0VwNEk}")
    private String webApiKey;

    private final com.crm.config.FirebaseConfig firebaseConfig;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Autowired
    public FirebaseAuthServiceImpl(com.crm.config.FirebaseConfig firebaseConfig,
                                   ObjectMapper objectMapper) {
        this.firebaseConfig = firebaseConfig;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    @Override
    public String createFirebaseUser(String email, String password, String displayName) {
        // 1. If Firebase Admin SDK is available with credentials
        FirebaseAuth firebaseAuth = firebaseConfig.getFirebaseAuth();
        if (firebaseAuth != null) {
            try {
                UserRecord.CreateRequest request = new UserRecord.CreateRequest()
                        .setEmail(email)
                        .setPassword(password)
                        .setDisplayName(displayName);
                UserRecord userRecord = firebaseAuth.createUser(request);
                logger.info("Created Firebase user via Admin SDK: uid={}, email={}", userRecord.getUid(), email);
                return userRecord.getUid();
            } catch (Exception ex) {
                logger.warn("Admin SDK createUser error: {}. Attempting REST fallback...", ex.getMessage());
            }
        }

        // 2. Identity Toolkit REST API with retry
        for (int attempt = 1; attempt <= 2; attempt++) {
            try {
                String url = "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + webApiKey;

                Map<String, Object> payload = new HashMap<>();
                payload.put("email", email);
                payload.put("password", password);
                payload.put("returnSecureToken", true);

                String requestBody = objectMapper.writeValueAsString(payload);

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(url))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                        .build();

                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                JsonNode root = objectMapper.readTree(response.body());

                if (response.statusCode() == 200) {
                    String localId = root.path("localId").asText();
                    logger.info("Created Firebase user via REST API: uid={}, email={}", localId, email);
                    return localId;
                } else {
                    String errorMessage = root.path("error").path("message").asText();
                    if ("EMAIL_EXISTS".equalsIgnoreCase(errorMessage)) {
                        logger.info("User already exists in Firebase Auth for email: {}", email);
                        return null;
                    }
                    logger.warn("Firebase REST signup failed: status={}, response={}", response.statusCode(), response.body());
                    return null;
                }
            } catch (Exception e) {
                if (attempt == 2) {
                    logger.error("Failed to create Firebase user: {}", e.getMessage(), e);
                } else {
                    logger.warn("Transient network error creating Firebase user, retrying: {}", e.getMessage());
                }
            }
        }
        return null;
    }

    @Override
    public void deleteFirebaseUser(String firebaseUid) {
        if (firebaseUid == null || firebaseUid.trim().isEmpty()) {
            return;
        }

        FirebaseAuth firebaseAuth = firebaseConfig.getFirebaseAuth();
        if (firebaseAuth != null) {
            try {
                firebaseAuth.deleteUser(firebaseUid);
                logger.info("Deleted Firebase user via Admin SDK: uid={}", firebaseUid);
            } catch (Exception e) {
                logger.warn("Could not delete user in Firebase: {}", e.getMessage());
            }
        }
    }

    @Override
    public void updateFirebaseUserPassword(String firebaseUid, String newPassword) {
        if (firebaseUid == null || firebaseUid.trim().isEmpty()) {
            return;
        }

        FirebaseAuth firebaseAuth = firebaseConfig.getFirebaseAuth();
        if (firebaseAuth != null) {
            try {
                UserRecord.UpdateRequest request = new UserRecord.UpdateRequest(firebaseUid)
                        .setPassword(newPassword);
                firebaseAuth.updateUser(request);
                logger.info("Updated Firebase user password for uid={}", firebaseUid);
            } catch (Exception e) {
                logger.warn("Could not update user password in Firebase: {}", e.getMessage());
            }
        }
    }
}
