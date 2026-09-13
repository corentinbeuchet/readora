---
sessionId: session-260913-094451-1ng7
---

# Execution Plan

### ✓ Step 1: S3 & MinIO Spring Configuration Bean Definitions
Provide `S3ClientConfig.java` in `readora-infrastructure` defining Spring beans for `S3Client` and `S3Presigner` with support for custom endpoints (MinIO), path-style access, custom credentials, and default AWS fallback credentials.

### ✓ Step 2: S3StorageAdapter AWS SDK Integration & Fallback
Integrate AWS SDK v2 (`S3Client`, `S3Presigner`) into `S3StorageAdapter` for `putObject`, `getObject`, `storeAsset`, `loadAsset`, `generatePresignedUploadUrl`, and `getPublicCdnUrl`, maintaining disk/memory fallback if S3/MinIO is unreachable.

### ✓ Step 3: Docker Compose MinIO Provisioner & Application Properties
Add `minio-init` service (`quay.io/minio/mc:latest`) to `docker-compose.yml` to automatically create `readora-media-dev` and set public download policy, and update `application.yml`, `application-staging.yml`, and `application-prod.yml` with MinIO and S3 property mappings.

### ✓ Step 4: Automated Testing & Verification
Create `S3StorageAdapterTest.java` and update `StorageControllerIntegrationTest.java` to test S3Client operations, MinIO endpoint behavior, URL resolution, and verify all test suites across the project.

### Overview & Goals
Ensure seamless, environment-aware object storage for Readora that supports **Local MinIO (S3-compatible)** in local development and Docker Compose, while seamlessly utilizing **AWS S3 + CloudFront CDN** in Staging and Production.

This architecture ensures:
1. **Local Development with MinIO**: Assets uploaded in local dev or Docker Compose are stored in a local MinIO bucket (`readora-media-dev`) and accessible via `http://localhost:9000/readora-media-dev/...` or presigned URLs.
2. **Auto-Provisioning**: Local MinIO automatically initializes the default media bucket with public read access on container startup without manual intervention.
3. **Production AWS S3 + CloudFront**: In staging and production profiles, storage automatically targets AWS S3 with CDN delivery via CloudFront domains (`https://cdn.readora.com`).
4. **Resilient Fallback**: Standalone local development without Docker gracefully falls back to local disk and memory caching via `/api/v1/storage/assets/**`.

---

### Scope

#### In Scope
- **S3 & MinIO Spring Configuration**: Provide Spring beans for `S3Client` and `S3Presigner` supporting custom endpoint overrides (`aws.s3.endpoint`), path-style access (`aws.s3.path-style-access-enabled`), and credentials (`aws.s3.access-key-id`, `aws.s3.secret-access-key`).
- **S3StorageAdapter SDK Integration**: Implement AWS SDK v2 `S3Client.putObject`, `S3Client.getObject`, and `S3Presigner` in `S3StorageAdapter` for real S3/MinIO object operations.
- **Docker Compose MinIO Provisioner**: Add an automated bucket initialization service (`minio-init` via `quay.io/minio/mc:latest`) in `docker-compose.yml` to create `readora-media-dev` and set public read policy.
- **Environment Profiles**: Align `application.yml`, `application-staging.yml`, and `application-prod.yml` with correct S3 and CDN configuration defaults.

#### Out of Scope
- Migrating historical media from external legacy CDNs.
- Multi-region S3 replication.

---

### User Stories
- **As a Developer**, I want to run `docker compose up` and have MinIO automatically ready to receive and serve uploaded manga covers and chapter pages without manual bucket creation in the MinIO web console.
- **As a Creator in Local Dev**, I want uploaded files to be stored directly in MinIO with accurate URLs so I can test real S3-like uploads.
- **As a DevOps Engineer**, I want the exact same `S3StorageAdapter` and `StoragePort` code to run against AWS S3 and CloudFront in production by changing environment variables.

---

### Functional Requirements
1. **MinIO Auto-Init**: Docker Compose must automatically run `mc mb` and `mc anonymous set download` for `readora-media-dev`.
2. **S3 SDK Compatibility**: Storage operations must use AWS SDK v2 `S3Client` capable of talking to both standard AWS endpoints and local MinIO endpoints.
3. **CDN & Direct URL Resolution**:
   - Production / Staging: `https://<cdn-domain>/<key>`
   - Local MinIO: `http://localhost:9000/<bucket>/<key>`
   - Standalone fallback: `/api/v1/storage/assets/<key>`
4. **Graceful Error Handling**: If MinIO or S3 is unreachable during local development, the system logs a descriptive warning and falls back to local disk storage.

# Technical Design

### Current Implementation
- `S3StorageAdapter` in `readora-infrastructure` handles asset caching and URL generation, with AWS SDK v2 BOM and `software.amazon.awssdk:s3` already included in `pom.xml`.
- `docker-compose.yml` includes a MinIO service, but requires automatic bucket creation and bucket policy initialization.
- Backend configuration in `application.yml` and `application-prod.yml` defines `aws.s3.bucket-name` and `aws.cloudfront.domain`.

---

### Key Decisions
1. **Unified AWS SDK v2 Client**: Use standard `software.amazon.awssdk.services.s3.S3Client` configured with `endpointOverride(...)` and `forcePathStyle(true)` when a custom endpoint (MinIO) is configured.
2. **MinIO Initialization Service in Compose**: Use a lightweight `quay.io/minio/mc:latest` container in `docker-compose.yml` with `depends_on: minio: service_healthy` to execute `mc alias set` and `mc anonymous set download local/readora-media-dev`.
3. **Environment Property Structure**:
   ```yaml
   aws:
     s3:
       bucket-name: ${AWS_S3_BUCKET_NAME:readora-media-dev}
       region: ${AWS_REGION:us-east-1}
       endpoint: ${AWS_S3_ENDPOINT:}
       access-key-id: ${AWS_ACCESS_KEY_ID:}
       secret-access-key: ${AWS_SECRET_ACCESS_KEY:}
       path-style-access-enabled: ${AWS_S3_PATH_STYLE_ACCESS_ENABLED:false}
     cloudfront:
       domain: ${CLOUDFRONT_DOMAIN:}
   ```

---

### Architecture Diagram

```mermaid
graph TD
  subgraph LocalDev ["Local Development (Docker Compose)"]
    BE1[Readora Backend]
    MC[minio-init (mc)]
    MINIO[(MinIO Container :9000)]
    MC -->|Auto create & public policy| MINIO
    BE1 -->|S3Client Put/Get (Path-style)| MINIO
    Browser1[Web Browser] -->|Direct HTTP :9000/readora-media-dev| MINIO
  end

  subgraph Production ["Production (AWS)"]
    BE2[Readora Backend]
    S3[(Amazon S3 Bucket)]
    CF[Amazon CloudFront CDN]
    BE2 -->|S3Client Put/Get (Virtual-hosted)| S3
    S3 --> CF
    Browser2[Web Browser] -->|HTTPS CDN| CF
  end
```

---

### File Structure & Changes

#### Backend Infrastructure & Config
- `backend/readora-infrastructure/src/main/java/com/readora/infrastructure/config/S3ClientConfig.java` (New: S3Client and S3Presigner bean definitions with MinIO endpoint overrides).
- `backend/readora-infrastructure/src/main/java/com/readora/infrastructure/storage/S3StorageAdapter.java` (Updated: integrates S3Client for put/get/presign operations with local fallback).
- `backend/readora-web/src/main/resources/application.yml` (Updated: add `aws.s3.endpoint`, `access-key-id`, `secret-access-key`, `path-style-access-enabled`).
- `backend/readora-web/src/main/resources/application-prod.yml` (Updated: prod AWS S3 and CloudFront defaults).

#### Docker Compose
- `docker-compose.yml` (Updated: add `minio-init` service with `quay.io/minio/mc:latest` and configure backend with `AWS_S3_ENDPOINT: http://minio:9000`, `CLOUDFRONT_DOMAIN: http://localhost:9000/readora-media-dev`).

---

### Risks & Mitigations
- **MinIO Startup Race Condition**: `minio-init` and `backend` must both wait for `minio` healthcheck (`service_healthy`) before executing commands.
- **CORS for In-Browser Direct Fetches**: MinIO public bucket policy and default headers allow image loading in Angular frontend without CORS blocks.

# Testing

### Validation Approach
Verification will be done using automated unit/integration tests and local Docker Compose validation.

---

### Key Scenarios
1. **S3Client Configuration**:
   - Verify `S3Client` correctly applies `endpointOverride` and `forcePathStyle` when `aws.s3.endpoint` is provided.
   - Verify `S3Client` connects with standard AWS region and credentials provider when `aws.s3.endpoint` is omitted.
2. **Upload & Retrieve with MinIO / S3**:
   - Verify `S3StorageAdapter.storeAsset` writes to S3/MinIO bucket.
   - Verify `S3StorageAdapter.loadAsset` retrieves content from S3/MinIO.
   - Verify `S3StorageAdapter.getPublicCdnUrl` resolves proper bucket/CDN path for both MinIO and CloudFront.
3. **Docker Compose Auto-Provisioning**:
   - Verify `minio-init` runs on `docker compose up` and leaves `readora-media-dev` in a publicly readable state.

---

### Edge Cases
- MinIO service temporarily unreachable: `S3StorageAdapter` logs warning and maintains local disk/memory cache so application continues operating.
- Missing credentials in local environment: S3Client defaults to anonymous / default credentials provider without throwing startup exceptions.

---

### Test Changes
- `S3StorageAdapterTest.java`: Unit tests testing S3Client upload, retrieval, and URL formatting for both MinIO and AWS CloudFront scenarios.
- `StorageControllerIntegrationTest.java`: Integration tests verifying multipart file upload and asset URL delivery.