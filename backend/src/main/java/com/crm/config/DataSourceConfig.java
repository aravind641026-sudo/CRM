package com.crm.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.util.StringUtils;

import javax.sql.DataSource;
import java.net.URI;

/**
 * Robust cloud-native DataSource configuration.
 * Automatically parses cloud standard DATABASE_URL (e.g. Render / Heroku / Neon format)
 * and safely converts it to a HikariCP PostgreSQL JDBC connection pool.
 */
@Configuration
public class DataSourceConfig {

    private static final Logger log = LoggerFactory.getLogger(DataSourceConfig.class);

    @Bean
    @Primary
    public DataSource dataSource(DataSourceProperties properties) {
        String databaseUrl = System.getenv("DATABASE_URL");
        if (!StringUtils.hasText(databaseUrl)) {
            databaseUrl = System.getProperty("DATABASE_URL");
        }
        if (StringUtils.hasText(databaseUrl) && !databaseUrl.contains("YOUR_")) {
            log.info("Detected cloud DATABASE_URL environment variable. Initializing PostgreSQL pool...");
            try {
                return createDataSourceFromUrl(databaseUrl);
            } catch (Exception e) {
                log.error("Failed to parse DATABASE_URL: {}. Falling back to default Spring properties.", databaseUrl, e);
            }
        }

        // Standard properties fallback (handles spring.datasource.*, PGHOST, PGUSER, etc.)
        return properties.initializeDataSourceBuilder().type(HikariDataSource.class).build();
    }

    private DataSource createDataSourceFromUrl(String rawUrl) throws Exception {
        HikariConfig config = new HikariConfig();

        if (rawUrl.startsWith("jdbc:mysql:")) {
            config.setJdbcUrl(rawUrl);
            config.setDriverClassName("com.mysql.cj.jdbc.Driver");
            String username = System.getenv("DATABASE_USERNAME");
            if (!StringUtils.hasText(username)) username = System.getProperty("DATABASE_USERNAME");
            if (StringUtils.hasText(username)) config.setUsername(username);
            String password = System.getenv("DATABASE_PASSWORD");
            if (!StringUtils.hasText(password)) password = System.getProperty("DATABASE_PASSWORD");
            if (password != null) config.setPassword(password);
        } else if (rawUrl.startsWith("jdbc:")) {
            config.setJdbcUrl(rawUrl);
            if (rawUrl.startsWith("jdbc:postgresql:")) {
                config.setDriverClassName("org.postgresql.Driver");
            }
        } else {
            // e.g., postgres://user:password@host:port/dbname?sslmode=require
            URI uri = new URI(rawUrl);
            String userInfo = uri.getUserInfo();
            if (userInfo != null && userInfo.contains(":")) {
                String[] parts = userInfo.split(":", 2);
                config.setUsername(parts[0]);
                config.setPassword(parts[1]);
            }

            String host = uri.getHost();
            int port = uri.getPort() > 0 ? uri.getPort() : 5432;
            String path = uri.getPath(); // /dbname
            if (path.startsWith("/")) {
                path = path.substring(1);
            }

            String jdbcUrl = "jdbc:postgresql://" + host + ":" + port + "/" + path;
            String query = uri.getQuery();
            if (StringUtils.hasText(query)) {
                jdbcUrl += "?" + query;
                if (!query.contains("sslmode=")) {
                    jdbcUrl += "&sslmode=require";
                }
            } else {
                jdbcUrl += "?sslmode=require";
            }
            if (!jdbcUrl.contains("reWriteBatchedInserts=")) {
                jdbcUrl += (jdbcUrl.contains("?") ? "&" : "?") + "reWriteBatchedInserts=true";
            }

            config.setJdbcUrl(jdbcUrl);
            config.setDriverClassName("org.postgresql.Driver");
        }

        config.setMaximumPoolSize(10);
        config.setMinimumIdle(2);
        config.setIdleTimeout(30000);
        config.setConnectionTimeout(30000);
        config.setMaxLifetime(600000);
        config.setLeakDetectionThreshold(60000);

        return new HikariDataSource(config);
    }
}
