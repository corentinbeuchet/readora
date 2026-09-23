# Readora AWS Staging & Production Deployment Guide

This actionable step-by-step blueprint allows teams with zero prior AWS expertise to launch Readora with isolated pre-production (Staging) and live (Production) environments.

---

## Architecture Summary

```
                      +-----------------------------+
                      |    Amazon Route 53 DNS      |
                      +--------------+--------------+
                                     |
              +----------------------+----------------------+
              |                                             |
   (staging.readora.com)                              (readora.com)
              |                                             |
   +----------v----------+                       +----------v----------+
   | CloudFront (Staging)|                       | CloudFront (Prod)   |
   +----------+----------+                       +----------+----------+
              |                                             |
     +--------+--------+                           +--------+--------+
     |                 |                           |                 |
+----v----+       +----v-------+              +----v----+       +----v-------+
| S3 App  |       | App Runner |              | S3 App  |       | App Runner |
| Staging |       | (Staging)  |              | Prod    |       | (Prod)     |
+---------+       +----+-------+              +---------+       +----+-------+
                       |                                             |
               +-------+-------+                             +-------+-------+
               |               |                             |               |
          +----v----+     +----v----+                   +----v----+     +----v----+
          | RDS DB  |     | S3 Scans|                   | RDS DB  |     | S3 Scans|
          | Staging |     | Staging |                   | Multi-AZ|     | Prod    |
          +---------+     +---------+                   +---------+     +---------+
```

---

## Step 1: AWS Account & IAM Configuration
1. Open the [AWS Console](https://console.aws.amazon.com/) and create your account. Enable **MFA** on root.
2. In **IAM (Identity and Access Management)**:
   - Create an IAM User named `readora-ci-bot`.
   - Attach permission policy `AdministratorAccess` (or scoped policies for App Runner, S3, CloudFront, RDS).
   - Go to **Security credentials** -> **Create access key** -> Choose "Application running outside AWS".
   - Save `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.

---

## Step 2: Database Setup (Amazon RDS PostgreSQL)

### Staging Database
1. Go to **Amazon RDS** -> **Databases** -> **Create database**.
2. Select **PostgreSQL 16+**.
3. Template: **Free tier** or **Dev/Test** (`db.t4g.micro`, 20GB GP3 storage).
4. DB instance identifier: `readora-staging-db`.
5. Master username: `readora_staging`, password: `<choose-secure-staging-pw>`.
6. Public access: No (or Yes temporarily if connecting directly from local without VPN).
7. Note down the endpoint (e.g. `readora-staging-db.cxxxx.eu-west-1.rds.amazonaws.com`).

### Production Database
1. Repeat above with template: **Production**.
2. Instance: `db.t4g.small` with **Multi-AZ Deployment** enabled for automatic high availability and failover.
3. Identifier: `readora-prod-db`, username: `readora_prod`.

---

## Step 3: S3 Buckets & CloudFront CDN

### Create 4 S3 Buckets:
1. `readora-frontend-staging` (Frontend static SPA)
2. `readora-frontend-prod` (Frontend static SPA)
3. `readora-media-staging` (Scan images & archives)
4. `readora-media-prod` (Scan images & archives)

### CloudFront Distributions
1. Create CloudFront distribution targeting `readora-frontend-staging`.
   - Default root object: `index.html`
   - **Error page: HTTP 403/404 -> `/index.csr.html` with response code 200.** The frontend is built with `outputMode: "static"` (prerendering): public routes (`/`, `/works`, `/works/{id}`, `/read/{id}`) are emitted as real `index.html` files for SEO, while every other route (login, profile, scanlation, unknown ids) must fall back to the client-side shell `index.csr.html`, **not** `index.html` (which is the prerendered home page).
   - Upload the whole `dist/readora-frontend/browser/` folder (it also contains `robots.txt` and `sitemap.xml`).
2. Create CloudFront distribution targeting `readora-frontend-prod`.

### Frontend build & prerendering

`npm run build` (or `build:staging`) prerenders the public catalog pages by calling the **backend API at build time** (`environment.apiUrl`) to discover work and chapter ids, then `postbuild` writes `sitemap.xml` from the same API.

- CI must therefore run the frontend build **after** the backend of the target environment is deployed and reachable (for staging: `https://staging-api.readora.com`).
- If the API is unreachable the build still succeeds: only `/` and `/works` are prerendered and the sitemap contains the static routes (a `[prerender] Catalog API unreachable` warning is printed). Dynamic pages are then served by `index.csr.html` through the CloudFront fallback above.
- Optional overrides for the sitemap step: `READORA_API_URL`, `READORA_SITE_URL`, `READORA_OUT_DIR`.
- The public origin used for canonical URLs / Open Graph tags is `environment.siteUrl` (`https://staging.readora.com`, `https://readora.com`).
- Local development against the Docker backend: `ng serve --proxy-config proxy.conf.json` proxies `/api` to `localhost:8080` (alternative to CORS + `SameSite=Lax` cookies).

---

## Step 4: Backend Container Deployment (AWS App Runner)

AWS App Runner manages automatic load balancing, TLS certificate provisioning, and autoscaling.

1. Go to **AWS App Runner** -> **Create service**.
2. Source: **Source code repository** (Connect your GitHub repo: `Readora`).
3. Branch: `main`. Deployment trigger: **Automatic**.
4. Runtime: **Java 25**.
   - Build command: `cd backend && mvn -pl readora-web -am clean package -DskipTests`
   - Start command: `java -jar backend/readora-web/target/readora-web-0.0.1-SNAPSHOT.jar`
   - Port: `8080`
5. Environment Variables:
   - `SPRING_PROFILES_ACTIVE`: `staging` (or `production`)
   - `SPRING_DATASOURCE_URL`: `jdbc:postgresql://<rds-endpoint>:5432/readoradb`
   - `SPRING_DATASOURCE_USERNAME`: `readora_staging`
   - `SPRING_DATASOURCE_PASSWORD`: `<password>`
   - `AWS_S3_BUCKET_NAME`: `readora-media-staging`
   - `READORA_CORS_ALLOWED_ORIGINS`: `https://staging.readora.com` (comma-separated list of allowed frontend origins)
   - `READORA_JWT_SECRET`: a random secret of **at least 32 bytes** (`openssl rand -base64 48`). Access tokens are HS256-signed with it; rotating it logs every user out.
   - `READORA_COOKIE_SECURE`: `true` (refresh-token cookie is `HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth`)
6. Click **Deploy**. App Runner will output your live URL (e.g., `https://xxxxxx.eu-west-1.awsapprunner.com`).

---

## Step 5: GitHub Actions Secrets Configuration

In your GitHub repository, navigate to **Settings** -> **Secrets and variables** -> **Actions** and add:

| Secret Name | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM User Access Key |
| `AWS_SECRET_ACCESS_KEY` | IAM User Secret Key |
| `AWS_APPRUNNER_STAGING_ARN` | ARN of App Runner Staging Service |
| `AWS_APPRUNNER_PROD_ARN` | ARN of App Runner Production Service |
| `CLOUDFRONT_STAGING_DIST_ID` | CloudFront Distribution ID for Staging |
| `CLOUDFRONT_PROD_DIST_ID` | CloudFront Distribution ID for Prod |
| `READORA_JWT_SECRET` | 32+ byte HS256 secret for access tokens (only if CI deploys env vars) |

Every commit to `main` will automatically build, deploy to Staging, and execute the Playwright UI test suite against your live staging URL!

---

## Step 6: Quality gates (run in CI before deploying)

| Command | What it checks |
|---|---|
| `cd backend && mvn -pl readora-web -am test` | Domain rules, ArchUnit hexagonal boundaries, JWT security matrix (401/403), auth, bookmarks and catalog integration tests (H2) |
| `cd frontend && npm run lint` | angular-eslint: template accessibility, `prefer-signals`, `prefer-control-flow`, `button-has-type`, `alt-text`, `no-inline-styles`, … |
| `cd frontend && npm run test:ci` | Vitest unit tests (auth store, interceptor, guards, `*appHasPermission`, Signal Forms pages, API-driven reader / comments / kanban) |
| `cd frontend && npm run build` | Prerendered static output + `sitemap.xml` (needs the API reachable for full coverage, see Step 3) |
| `cd frontend && npm run e2e:staging` | Playwright: register → login → profile, guarded routes, reader against the live staging stack |
