# Secure Cloud-Based Question Paper Management System Using Blockchain and Encryption

## Project Overview

This application securely creates, reviews, approves, schedules, and releases examination question papers. Examination papers need confidentiality (no early access) and integrity (no unnoticed changes). The backend encrypts uploaded PDFs with AES-256-GCM, calculates SHA-256 over the encrypted artifact, stores it privately, and releases it only after server-side authorization and timing checks.

Question Setter → Reviewer → Security Officer → Exam Authority → **LOCKED** → scheduled release → Exam Centre. MFA, JWT, RBAC, encryption, hashing, private storage, audit logs, optional AWS KMS/S3, and optional blockchain integrity anchoring work together. The frontend is not a security boundary: the backend independently controls authorization, storage, encryption, integrity, and release time.

## Problem Statement

Unauthorized access and uncontrolled file sharing can leak a paper. Tampering can change its contents, and informal approvals make accountability difficult. A solution needs private encrypted storage, controlled multi-level approval, auditable actions, tamper detection, and release-time access control.

## Objectives

- Secure PDF upload and encryption at rest.
- SHA-256 integrity verification before decryption.
- RBAC, MFA, JWT sessions, and logout-token revocation.
- Multi-level approval, locking, scheduled release, and Exam Centre access.
- Private local storage and optional AWS S3/KMS storage.
- Optional blockchain-based integrity anchoring, audit logging, and security monitoring.

## Main Features

- Registration for permitted roles; login, OTP MFA, JWT, and logout revocation.
- Role-specific dashboards, Admin user management, and Admin-created Exam Centre accounts.
- Draft creation, PDF upload validation, AES-256-GCM encryption, SHA-256 hashing, and private encrypted storage.
- Reviewer, Security Officer, and Exam Authority claim/approve/reject stages with conflict-of-interest checks.
- Final locking, one-time release scheduling, safe Exam Centre metadata listing, and secure release.
- Optional AWS S3/KMS and blockchain integrity verification.
- Audit logs, tamper detection, and fail-closed security behavior.

## User Roles

| Role | Responsibility |
| --- | --- |
| `ADMIN` | Manages users, account status, Exam Centre accounts, dashboards, audit logs, and security activity. |
| `QUESTION_SETTER` | Creates drafts, uploads/submits PDFs, tracks status, and revises eligible rejected papers. |
| `REVIEWER` | Claims eligible submissions and approves/rejects review assignments. |
| `SECURITY_OFFICER` | Performs the security review and approval stage. |
| `EXAM_AUTHORITY` | Performs final approval, locking, and release scheduling. |
| `EXAM_CENTER` | Views safe metadata and requests a paper only through secure release. |

Public registration is allowed only for `QUESTION_SETTER`, `REVIEWER`, `SECURITY_OFFICER`, and `EXAM_AUTHORITY`. `ADMIN` and `EXAM_CENTER` cannot register publicly. Only Admin creates Exam Centre accounts; the backend enforces this rule and does not trust a frontend role value.

## Technologies and Tools

| Area | Technologies |
| --- | --- |
| Frontend | React, Vite, React Router, Axios, CSS |
| Backend | Node.js, Express, MongoDB, Mongoose |
| Security | bcrypt, JWT, OTP MFA, Helmet, rate limiting, AES-256-GCM, SHA-256 |
| Cloud | AWS S3, AWS KMS, AWS SDK |
| Blockchain | Solidity, Hardhat, Ethers.js |
| Testing | Node.js built-in test runner |

## System Architecture

```text
User → React Frontend → Express REST API
                         ↓
              Authentication + MFA + RBAC
                         ↓
 MongoDB ← Encryption / Integrity Services → Local Storage OR private AWS S3 + KMS
                         ↓
      Blockchain Integrity Registry (when enabled)
                         ↓
 Approval Workflow → Scheduled Release → Exam Centre → Secure PDF Release
```

Blockchain does not store PDFs. It is an integrity/audit layer only.

## Complete Question Paper Workflow

1. A Question Setter registers using an allowed role and completes MFA login.
2. The setter creates a draft and uploads a PDF.
3. The backend validates the PDF type, `%PDF-` signature, and configured size limit.
4. A fresh per-paper AES-256-GCM key and IV encrypt the PDF.
5. SHA-256 is calculated over the persisted ciphertext; encrypted storage metadata is saved in MongoDB.
6. The setter submits the paper.
7. A Reviewer claims and approves/rejects it; self-review is blocked.
8. A Security Officer claims the reviewer-approved paper and approves/rejects it.
9. An Exam Authority claims the security-approved paper, completes final approval, and locks it.
10. With blockchain mode enabled, integrity metadata is anchored after locking.
11. The locking Exam Authority schedules release.
12. Before the server-side release time, Exam Centre access is denied.
13. At/after release, the backend checks authentication, role, lock/release state, server time, and SHA-256.
14. It verifies blockchain metadata when enabled; only after checks pass does key protection/decryption occur.
15. The PDF is returned and security-sensitive actions are audited.

## Encryption and Integrity Workflow

```text
Original PDF → AES-256-GCM → Encrypted Artifact → SHA-256
                                             ↓
                       MongoDB Hash → Blockchain Hash (when enabled)
                                             ↓
                     Verification Before Decryption → KMS / Master-Key Protection
                                             ↓
                                   AES-GCM Decryption → PDF
```

SHA-256 is calculated over the encrypted artifact. Tampering changes the hash; the backend blocks release, does not decrypt, returns no PDF, and logs an audit/security event. Expected result: `INTEGRITY VERIFICATION FAILED`.

Never store plaintext passwords, public plaintext question papers, PDF contents or AES keys on blockchain, AWS credentials in frontend code, or blockchain private keys in frontend code. Integrity verification precedes decryption.

## Local Storage Mode

Default development storage:

```dotenv
STORAGE_PROVIDER=local
QUESTION_PAPER_MASTER_KEY=<locally-generated-base64-key>
```

The master key protects each per-paper key. Generate it locally:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Never commit this key, put it in frontend code, or include a real value in `.env.example`.

## Optional AWS S3 + KMS Mode

S3/KMS is configuration-dependent. The bucket must be private with Block Public Access enabled; only encrypted artifacts are stored. KMS protects key material, and the backend—not the frontend—performs AWS operations.

```dotenv
STORAGE_PROVIDER=s3
AWS_REGION=<your-region>
AWS_S3_BUCKET=<your-private-bucket>
AWS_KMS_KEY_ID=<your-kms-key-id>
```

1. Create a private S3 bucket and enable Block Public Access.
2. Create/select a KMS key and configure least-privilege IAM permissions.
3. Set the environment variables and use the standard AWS credential provider chain.
4. Start the backend and test encrypted upload and secure retrieval.

Do not commit AWS credentials or expose them to the frontend.

## MongoDB Setup

MongoDB must run locally or be provided as a URI. It stores users, paper metadata, approvals, audit logs, revoked tokens, and security records—not plaintext PDFs.

```dotenv
# Example format only
MONGO_URI=mongodb://127.0.0.1:27017/secure_question_paper_system
```

`MONGODB_URI` is also accepted for compatibility.

## Blockchain / Hardhat Setup

Blockchain is optional. For local development, the contract is [QuestionPaperRegistry.sol](blockchain/contracts/QuestionPaperRegistry.sol) and stores integrity metadata only—not PDFs, plaintext, AES/DEK keys, credentials, or application secrets.

```bash
cd blockchain
npm install
npx hardhat node
```

Keep the node running. In another terminal:

```bash
cd blockchain
npx hardhat run scripts/deploy.js --network localhost
```

```dotenv
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
BLOCKCHAIN_PRIVATE_KEY=<local-hardhat-account-private-key>
BLOCKCHAIN_CONTRACT_ADDRESS=<deployed-contract-address>
```

Use a local Hardhat key only. Never commit it, expose it to frontend code, or use production private keys in this repository.

## Installation Requirements

- Node.js and npm
- MongoDB
- Modern browser
- Optional: AWS configuration for S3/KMS
- Optional: Hardhat local node and deployed contract

AWS and blockchain are not required for the default local setup.

## Quick Start

From the project root, in Windows PowerShell:

```powershell
Copy-Item .env.example .env
npm run install:all
```

The repository has separate frontend, backend, and blockchain package/lock files. Do not commit `node_modules`.

## Environment Configuration

Create `.env` locally from `.env.example`; never commit it. The example file contains safe placeholders only.

| Variable | Purpose |
| --- | --- |
| `MONGO_URI` | MongoDB connection string. |
| `JWT_SECRET` | JWT signing secret. |
| `STORAGE_PROVIDER` | `local` or `s3`. |
| `QUESTION_PAPER_MASTER_KEY` | Local-mode protection for per-paper keys. |
| `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_KMS_KEY_ID` | S3/KMS configuration. |
| `BLOCKCHAIN_RPC_URL`, `BLOCKCHAIN_PRIVATE_KEY`, `CONTRACT_ADDRESS` | Optional blockchain configuration. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Locally configured Admin seed credentials. |

Also see `PORT`, `FRONTEND_URL`, `MAX_QUESTION_PAPER_SIZE_MB`, and `QUESTION_PAPER_STORAGE_DIR` in `.env.example`.

## Admin Seed Setup

```bash
npm run seed:admin --prefix backend
```

The Admin is created from environment variables and the seed prevents unintended duplicates. Configure credentials locally; do not hard-code production passwords.

## MFA / OTP Demo Mode

OTP MFA uses cryptographically generated six-digit OTPs. The backend hashes each OTP before storing it, expires it after five minutes, consumes it after successful verification, and invalidates the previous OTP whenever a new OTP is resent.

For a controlled college demonstration, set this **backend-only** variable in the project-root `.env`:

```dotenv
MFA_DISPLAY_OTP=true
```

The login and resend responses then temporarily include the newly generated `demoOtp`, which the Verify OTP page displays in a clearly marked **DEMO MODE** card. The same original OTP is hashed and validated; the plaintext OTP is never saved in MongoDB, audit logs, URLs, browser storage, JWTs, or cookies.

For production, use:

```dotenv
MFA_DISPLAY_OTP=false
```

In production, OTPs should be delivered through an appropriate secure channel such as email, SMS, an authenticator application, or an MFA provider. Do not use a `VITE_MFA_DISPLAY_OTP` setting: frontend variables are visible to browsers. Demo display is for a controlled project demonstration only, not a real security-sensitive deployment.

## How to Run

Run in separate terminals:

```bash
npm run dev --prefix backend
```

```bash
npm run dev --prefix frontend
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`
- Health: `http://localhost:5000/api/health`

## Login and Role Workflows

Login flow: register with an allowed role, login with email/password, complete OTP verification, receive JWT, and arrive at the role-specific dashboard: `/admin/dashboard`, `/question-setter/dashboard`, `/reviewer/dashboard`, `/security-officer/dashboard`, `/exam-authority/dashboard`, or `/exam-center/dashboard`.

- **Admin:** dashboard, users, Exam Centre creation, account status, audit logs, security activity. Admin alone creates Exam Centres.
- **Question Setter:** register/login/MFA, draft/upload/submit, status and rejection reason, eligible revision. Submitted/approved/locked papers resist unauthorized modification.
- **Reviewer:** eligible queue, claim, secure access, decision/rejection reason, history; self-review is blocked.
- **Security Officer:** eligible queue, claim, security review/decision, and security/audit activity.
- **Exam Authority:** security-approved review, final approval, locking, approval history, and schedule release. Only the locking authority can schedule.
- **Exam Centre:** Admin-created account, safe metadata only, denied before time, then secure backend checks before decryption. The list endpoint does not decrypt or expose PDFs.

## Scheduled Release

Only `LOCKED` papers can be scheduled. The timestamp is server-side; browser time is not trusted; scheduling cannot be changed after it is set. Before the time, the current implementation denies release (typically `403`); at/after it, secure checks begin.

```text
Exam: 20 September 2026, 09:00 AM
08:59 — ACCESS DENIED — PAPER LOCKED
09:00 — authorization and integrity checks are performed
```

## Blockchain Workflow

When enabled: locking verifies the artifact hash, anchors integrity metadata, waits for confirmation, stores safe transaction metadata, and verifies it during release. A mismatch blocks release/decryption. Blockchain is not file storage, encryption, password storage, or secret storage.

## API Overview

| Area | Important endpoints |
| --- | --- |
| Authentication | `POST /api/auth/register`, `/login`, `/verify-otp`, `/resend-otp`, `/logout`; `GET /api/auth/me` |
| Admin | `GET /api/admin/dashboard/stats`, `/users`, `/exam-centers`, `/audit-logs`; `POST /api/admin/exam-centers`; `PATCH /api/admin/users/:id/status` |
| Question papers | `POST /api/question-papers`; `GET /:id`, `/:id/download`, `/:id/release`, `/exam-center`; `POST /:id/upload`, `/:id/submit`, `/:id/revise` |
| Reviewer | `GET /api/reviewer/dashboard/stats`, `/question-papers`, `/:id`, `/:id/reviews`; `POST /:id/claim`, `/:id/approve`, `/:id/reject` |
| Security Officer | `GET /api/security-officer/dashboard/stats`, `/question-papers`, `/:id`, `/:id/approvals`; `POST /:id/claim`, `/:id/approve`, `/:id/reject` |
| Exam Authority | `GET /api/exam-authority/dashboard/stats`, `/question-papers`, `/:id`, `/:id/approvals`; `POST /:id/claim`, `/:id/approve`, `/:id/reject`, `/:id/schedule-release` |
| Health | `GET /api/health` |

Protected endpoints require authentication and the applicable role.

## Project Structure

```text
frontend/src/components  layouts and route protection
frontend/src/pages       role-specific screens
frontend/src/context     authentication context
frontend/src/services    API client
frontend/src/utils       helpers
backend/src/controllers  request handlers
backend/src/models       MongoDB models
backend/src/routes       REST routes
backend/src/middleware   auth, RBAC, upload, errors, rate limits
backend/src/services     encryption, storage, blockchain services
backend/src/config       configuration
backend/src/scripts      seed/maintenance scripts
backend/test             backend tests
blockchain/contracts     Solidity contract
blockchain/scripts       deployment
blockchain/test          contract tests
```

## Database / Data Models

| Model | Purpose |
| --- | --- |
| `User` | Identity, role, password hash, MFA data, active status, creator, login timestamp. |
| `QuestionPaper` | Metadata, encrypted storage/integrity/blockchain data, lifecycle, assignments, lock, release state. |
| `QuestionPaperApproval` | Security Officer/Exam Authority claim, decision, lock history. |
| `QuestionPaperReview` | Reviewer claim, decision, revision history. |
| `AuditLog` | Security-relevant actor/action/target/IP/user-agent/metadata/time records. |
| `RevokedToken` | Revoked JWT identifiers with expiry. |

## Testing

```bash
npm run build --prefix frontend
npm test --prefix backend
cd backend
node --test --test-concurrency=1 test/*.test.js
```

The already verified project state is **48 tests: 48 passed, 0 failed**. Coverage includes authentication, MFA, RBAC, Admin protections, ownership, encryption, S3/KMS, all approval stages, locking, scheduled release, Exam Centre access, SHA-256/blockchain verification, and fail-closed behavior. The frontend production build passed; normal React Router `use client` warnings may appear.

## Security Test: Tampering Demonstration

1. Upload a paper; it is encrypted and SHA-256 integrity data is stored.
2. Modify the encrypted artifact in a controlled development environment.
3. Attempt secure release; the backend recalculates SHA-256.
4. The mismatch blocks release: no KMS decryption, no AES decryption, no PDF, and an audit/security event.

```text
INTEGRITY VERIFICATION FAILED
Result: Release blocked
```

## Error Handling

| Status | Meaning |
| --- | --- |
| `401` | Authentication required, invalid/expired/revoked token, or inactive account. |
| `403` | Permission denied or a paper is unavailable for release. |
| `409` | Invalid state transition, such as modifying a submitted paper. |
| `422` | Integrity/blockchain verification or secure decryption/release failure. |
| `500` | Internal server error. |

The current release implementation uses `403`/ `422` rather than a `423` response.

## Security Considerations

The system applies bcrypt password hashing, MFA, JWT/revocation, backend RBAC, input/file validation and size limits, Helmet, CORS, rate limiting, AES-256-GCM, SHA-256, private storage, optional KMS, audit logging, fail-closed integrity behavior, and server-side time validation. No plaintext papers are placed in public storage; no secrets are placed in frontend or blockchain code.

## Environment / Secret Safety

Never commit `.env`, AWS credentials, JWT secrets, master keys, blockchain private keys, production credentials, question-paper files, `node_modules`, build output, logs, database files, or local encrypted artifacts. `.env.example` contains placeholders only.

## Sample Input and Output

Demonstration data only; no sample PDF is required in the repository.

```text
Question Paper
Title: WEB
Exam: SEM-5
Subject: WEB-TECH
PDF: sample-question-paper.pdf

Before release: Status LOCKED | Release SCHEDULED | Access DENIED
After release:  Status RELEASED | Integrity VERIFIED | Secure PDF access granted
Tampering:      INTEGRITY VERIFICATION FAILED | Release blocked
```

## College Demo Procedure

1. Start MongoDB, configure `.env`, seed Admin, then start backend and frontend.
2. Create/register required users; Admin creates the Exam Centre.
3. Question Setter creates, uploads, and submits a paper.
4. Reviewer approves; Security Officer approves; Exam Authority approves/locks and schedules.
5. Try Exam Centre access before time (expected: denied).
6. At release time, request the paper (expected: authorization/integrity checks then secure release).
7. Demonstrate controlled ciphertext tampering (expected: verification failure and blocked release).

## Future Enhancements

Not currently claimed: production OTP delivery, email/SMS notifications, richer monitoring, pagination/filtering, infrastructure as code, deployment automation, advanced audit reporting, production-grade key management, and additional security monitoring.

## Important Notes

- MongoDB must be available; this repository has no database dump or real credentials.
- Local encrypted storage supports development; S3/KMS and blockchain are optional/configuration-dependent.
- Blockchain stores metadata only, never question-paper content.
- Generated artifacts should not be committed, and `.env` must never be committed.

## Deployment

### Local development

Use Node.js **20.x or 22.x** (`>=20 <23`), MongoDB, and the project-root `.env`. Configure the public frontend API URL in `frontend/.env` with `VITE_API_BASE_URL=http://localhost:5000/api`.

Hardhat localhost is for development only. `MFA_DISPLAY_OTP=true` is allowed only for a controlled college demonstration; the backend never returns a demo OTP when `NODE_ENV=production`.

### Production architecture and configuration

Deploy the Vite build behind HTTPS, with a Node/Express API, managed MongoDB, private S3/KMS storage, and, when enabled, a reachable blockchain RPC plus deployed contract. Set backend values through a deployment secret manager:

```dotenv
NODE_ENV=production
MONGO_URI=<managed-mongodb-uri>
JWT_SECRET=<secret>
STORAGE_PROVIDER=s3
AWS_REGION=<region>
AWS_S3_BUCKET=<private-bucket>
AWS_KMS_KEY_ID=<kms-key-id>
FRONTEND_URL=https://your-frontend-domain
TRUST_PROXY=1
MFA_DISPLAY_OTP=false
BLOCKCHAIN_ENABLED=true
BLOCKCHAIN_RPC_URL=<reachable-rpc-url>
BLOCKCHAIN_PRIVATE_KEY=<backend-only-key>
BLOCKCHAIN_CONTRACT_ADDRESS=<deployed-contract-address>
```

Use `VITE_API_BASE_URL=https://api.example.com/api` only as a public frontend build variable. Never put backend secrets in `VITE_*` variables. `FRONTEND_URL` must be the exact allowed frontend origin; do not use wildcard CORS in production. `TRUST_PROXY` must match the actual reverse-proxy/load-balancer hop count, or be `false` when no proxy is trusted.

Build and start with `npm ci --prefix frontend`, `npm run build --prefix frontend`, `npm ci --prefix backend`, then `npm run start --prefix backend`.

For blockchain production mode, deploy the Solidity contract separately and configure the reachable RPC and `BLOCKCHAIN_CONTRACT_ADDRESS`; do not use a Hardhat development key. Keep S3 private with Block Public Access, least-privilege IAM, and KMS access only on the backend. The API verifies integrity before KMS/AES decryption and does not issue permanent public file URLs.

`GET /api/health` is a liveness endpoint. `GET /api/ready` verifies MongoDB readiness and returns `200` only when connected, otherwise `503`, without secrets. Production startup validates required configuration and exits if MongoDB is unavailable. Critical paper-security actions fail closed when their audit record cannot be persisted; ordinary audit failures are logged.

Back up MongoDB and encrypted storage, monitor API/audit/security logs, and use secure production OTP delivery. The bundled rate limiter is process-local and intended for a single backend instance; use shared rate-limit storage before horizontal scaling.
