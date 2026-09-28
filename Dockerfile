# ==============================================================================
# Multi-Stage Dockerfile for Calling CRM Spring Boot Backend (Root Directory)
# Optimized for Render, Fly.io, Railway, and Neon PostgreSQL
# ==============================================================================

FROM maven:3.9.6-eclipse-temurin-17-alpine AS builder
WORKDIR /workspace/app

# Pre-fetch backend dependencies
COPY backend/pom.xml .
RUN mvn dependency:go-offline -B

# Copy backend source code and build jar
COPY backend/src ./src
RUN mvn clean package -DskipTests

# Stage 2: Minimal Production JRE 17 Runtime
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

RUN addgroup -S crmgroup && adduser -S crmuser -G crmgroup
USER crmuser

COPY --from=builder /workspace/app/target/*.jar app.jar

ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]
