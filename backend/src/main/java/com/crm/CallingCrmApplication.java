package com.crm;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.TimeZone;

@SpringBootApplication
public class CallingCrmApplication {

    private static final Logger log = LoggerFactory.getLogger(CallingCrmApplication.class);

    @PostConstruct
    public void init() {
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Kolkata"));
    }

    public static void main(String[] args) {
        loadDotEnv();
        SpringApplication.run(CallingCrmApplication.class, args);
    }

    /**
     * Automatically loads .env file properties into Java System properties
     * for local development without requiring external dependencies.
     * Real OS / container environment variables always take top precedence.
     */
    private static void loadDotEnv() {
        String userDir = System.getProperty("user.dir", ".");
        String[] candidatePaths = {
            ".env",
            "backend/.env",
            "../.env",
            userDir + File.separator + ".env",
            userDir + File.separator + "backend" + File.separator + ".env"
        };

        for (String pathStr : candidatePaths) {
            try {
                Path path = Paths.get(pathStr);
                if (Files.exists(path) && Files.isRegularFile(path)) {
                    log.info("Loading environment variables from local .env: {}", path.toAbsolutePath());
                    List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);
                    for (String line : lines) {
                        line = line.trim();
                        if (line.isEmpty() || line.startsWith("#")) {
                            continue;
                        }
                        int eqIdx = line.indexOf('=');
                        if (eqIdx > 0) {
                            String key = line.substring(0, eqIdx).trim();
                            String value = line.substring(eqIdx + 1).trim();
                            if ((value.startsWith("\"") && value.endsWith("\"")) ||
                                (value.startsWith("'") && value.endsWith("'"))) {
                                value = value.substring(1, value.length() - 1);
                            }
                            // Only set if not already set in OS environment or System properties
                            if (System.getenv(key) == null && System.getProperty(key) == null) {
                                // Do not populate placeholder template values
                                if (!value.startsWith("YOUR_")) {
                                    System.setProperty(key, value);
                                }
                            }
                        }
                    }
                    break;
                }
            } catch (Exception e) {
                log.warn("Notice: Could not load .env from {}: {}", pathStr, e.getMessage());
            }
        }
    }
}
