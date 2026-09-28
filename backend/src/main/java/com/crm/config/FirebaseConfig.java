package com.crm.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;

@Configuration
public class FirebaseConfig {

    private static final Logger logger = LoggerFactory.getLogger(FirebaseConfig.class);

    @Value("${firebase.project-id:callingcrm-9c9fd}")
    private String projectId;

    @Value("${firebase.credentials-file:}")
    private String credentialsFile;

    private FirebaseApp firebaseApp;
    private FirebaseAuth firebaseAuth;

    @PostConstruct
    public void init() {
        try {
            if (!FirebaseApp.getApps().isEmpty()) {
                this.firebaseApp = FirebaseApp.getInstance();
                this.firebaseAuth = FirebaseAuth.getInstance(this.firebaseApp);
                return;
            }

            FirebaseOptions.Builder optionsBuilder = FirebaseOptions.builder()
                    .setProjectId(projectId);

            InputStream credentialsStream = null;

            if (credentialsFile != null && !credentialsFile.trim().isEmpty()) {
                File file = new File(credentialsFile);
                if (file.exists()) {
                    logger.info("Initializing Firebase Admin SDK using credentials file: {}", file.getAbsolutePath());
                    credentialsStream = new FileInputStream(file);
                } else {
                    InputStream cpStream = getClass().getClassLoader().getResourceAsStream(credentialsFile);
                    if (cpStream != null) {
                        logger.info("Initializing Firebase Admin SDK using classpath resource: {}", credentialsFile);
                        credentialsStream = cpStream;
                    }
                }
            }

            if (credentialsStream != null) {
                optionsBuilder.setCredentials(GoogleCredentials.fromStream(credentialsStream));
                this.firebaseApp = FirebaseApp.initializeApp(optionsBuilder.build());
                this.firebaseAuth = FirebaseAuth.getInstance(this.firebaseApp);
                logger.info("Firebase Admin SDK initialized successfully for project: {}", projectId);
            } else {
                try {
                    GoogleCredentials credentials = GoogleCredentials.getApplicationDefault();
                    optionsBuilder.setCredentials(credentials);
                    this.firebaseApp = FirebaseApp.initializeApp(optionsBuilder.build());
                    this.firebaseAuth = FirebaseAuth.getInstance(this.firebaseApp);
                    logger.info("Firebase Admin SDK initialized using Application Default Credentials for project: {}", projectId);
                } catch (Exception e) {
                    logger.info("No service account credentials file found. Dual-mode JWKS verifier will handle Firebase ID token verification directly.");
                }
            }
        } catch (Exception ex) {
            logger.warn("Could not initialize FirebaseApp with service credentials: {}. Fallback JWKS verifier will be used.", ex.getMessage());
        }
    }

    public FirebaseApp getFirebaseApp() {
        return firebaseApp;
    }

    public FirebaseAuth getFirebaseAuth() {
        return firebaseAuth;
    }

    public String getProjectId() {
        return projectId;
    }
}
