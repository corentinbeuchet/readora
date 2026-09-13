# Multi-stage build for Spring Boot 4.1 on Java 25
FROM eclipse-temurin:25-jdk-alpine AS builder
WORKDIR /workspace

COPY pom.xml ./
COPY readora-domain/pom.xml ./readora-domain/
COPY readora-application/pom.xml ./readora-application/
COPY readora-infrastructure/pom.xml ./readora-infrastructure/
COPY readora-web/pom.xml ./readora-web/
COPY readora-acceptance/pom.xml ./readora-acceptance/

COPY readora-domain/src ./readora-domain/src
COPY readora-application/src ./readora-application/src
COPY readora-infrastructure/src ./readora-infrastructure/src
COPY readora-web/src ./readora-web/src

# Install maven & package only the deployable module (and what it depends on)
RUN apk add --no-cache maven && \
    mvn -pl readora-web -am clean package -DskipTests

# Runtime Stage (Minimal JRE image)
FROM eclipse-temurin:25-jre-alpine
WORKDIR /app

RUN addgroup -S readora && adduser -S readora -G readora
USER readora:readora

COPY --from=builder /workspace/readora-web/target/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-XX:+UseZGC", "-jar", "app.jar"]
