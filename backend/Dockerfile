# Multi-stage build for Spring Boot 4.1 on Java 25
FROM eclipse-temurin:25-jdk-alpine AS builder
WORKDIR /workspace
RUN apk add --no-cache maven

# Dependencies first: this layer is reused until a pom.xml changes.
COPY pom.xml ./
COPY readora-domain/pom.xml ./readora-domain/
COPY readora-application/pom.xml ./readora-application/
COPY readora-infrastructure/pom.xml ./readora-infrastructure/
COPY readora-web/pom.xml ./readora-web/
COPY readora-acceptance/pom.xml ./readora-acceptance/
RUN mvn -B -q -pl readora-web -am dependency:go-offline

COPY readora-domain/src ./readora-domain/src
COPY readora-application/src ./readora-application/src
COPY readora-infrastructure/src ./readora-infrastructure/src
COPY readora-web/src ./readora-web/src

# Package only the deployable module (and what it depends on); tests run in CI.
RUN mvn -B -pl readora-web -am clean package -DskipTests

# Runtime Stage (Minimal JRE image)
FROM eclipse-temurin:25-jre-alpine
WORKDIR /app

RUN addgroup -S readora && adduser -S readora -G readora
USER readora:readora

COPY --from=builder /workspace/readora-web/target/*.jar app.jar

EXPOSE 8080
# The Spring profile (staging/production) comes from SPRING_PROFILES_ACTIVE at deploy time.
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:8080/actuator/health/liveness || exit 1
ENTRYPOINT ["java", "-XX:+UseZGC", "-XX:MaxRAMPercentage=75", "-XX:+ExitOnOutOfMemoryError", "-jar", "app.jar"]
