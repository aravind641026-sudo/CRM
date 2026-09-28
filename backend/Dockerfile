# ==============================================================================
# Multi-Stage Dockerfile for Calling CRM Spring Boot Backend
# Optimized for Render, Fly.io, Railway, and Neon PostgreSQL
# ==============================================================================

# Stage 1: Build JAR with Maven & Eclipse Temurin JDK 17
FROM maven:3.9.6-eclipse-temurin-17-alpine AS builder
WORKDIR /workspace/app

# Pre-fetch dependencies (layer caching)
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source code and build production jar
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: Minimal Production JRE 17 Runtime
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Create non-privileged user for security
RUN addgroup -S crmgroup && adduser -S crmuser -G crmgroup
USER crmuser

# Copy executable jar from builder stage
COPY --from=builder /workspace/app/target/*.jar app.jar

# Cloud environment port configuration
ENV PORT=8080
EXPOSE 8080

# Java runtime flags optimized for containerized cloud deployment
ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]
