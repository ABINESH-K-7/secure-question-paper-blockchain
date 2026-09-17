# Secure Cloud-Based Question Paper Management System Using Blockchain and Encryption

## 1. Project Title

Secure Cloud-Based Question Paper Management System Using Blockchain and Encryption

## 2. Project Overview

This web application creates, protects, reviews, approves, schedules, and securely releases examination question papers. The React frontend communicates with an Express and MongoDB backend. PDFs are encrypted before storage, protected with a SHA-256 integrity hash, and released only after server-side authorization and validation.

## 3. Problem Statement

Examination papers must remain confidential before an authorised release time while also being protected from tampering. Manual handling and insecure file sharing can expose papers or make it difficult to prove that an artifact is unchanged. This project provides a controlled, auditable workflow with separate responsibilities for each participant.

## 4. Objectives

- Protect uploaded PDF question papers using encryption at rest.
- Enforce a staged approval workflow with role-based access control.
- Verify encrypted-artifact integrity before protected access.
- Optionally anchor and verify integrity metadata on a blockchain.
- Schedule release after final approval and allow only an Exam Centre to obtain the PDF at the permitted time.
- Record security-sensitive activity in audit logs.

## 5. Main Features

- JWT authentication with MFA OTP verification and logout token revocation.
- Six role-specific workspaces and backend RBAC enforcement.
- PDF upload, private encrypted storage, SHA-256 verification, and secure download/release paths.
- Reviewer, Security Officer, and Exam Authority approval stages with conflict-of-interest controls.
- Final paper locking and scheduled release.
- Optional private AWS S3 storage with AWS KMS envelope encryption.
- Optional blockchain anchoring and release-time blockchain integrity verification.
- Admin dashboard, user status management, Exam Centre creation, and audit-log viewing.

## 6. User Roles

| Role | Responsibility |
| --- | --- |
| `ADMIN` | Manages users, Exam Centre accounts, account status, dashboard data, and audit logs. |
| `QUESTION_SETTER` | Creates drafts, uploads PDFs, submits papers, and revises eligible rejected papers. |
| `REVIEWER` | Claims eligible submissions and approves or rejects review assignments. |
| `SECURITY_OFFICER` | Performs the security approval stage. |
| `EXAM_AUTHORITY` | Performs final approval, locks papers, and schedules release. |
| `EXAM_CENTER` | Lists releasable metadata and accesses a released PDF through the secure release endpoint. |

## 7. Technologies and Tools Used

- Frontend: React, Vite, React Router, Axios
- Backend: Node.js, Express, Mongoose, MongoDB
- Security: bcrypt, JSON Web Tokens, Helmet, rate limiting, AES-256-GCM, SHA-256
- Cloud mode: AWS S3 and AWS KMS SDKs
- Blockchain: Solidity, Hardhat, Ethers
- Testing: Node.js built-in test runner

## 8. System Architecture / Workflow

```text
Question Setter
  → Upload Question Paper
  → AES-256-GCM Encryption
  → SHA-256 Integrity Hash
  → Submit
  → Reviewer Approval
  → Security Officer Approval
  → Exam Authority Final Approval
  → LOCKED
  → Schedule Release
  → Exam Centre
  → Scheduled Time
  → SHA-256 Verification
  → Blockchain Verification (when enabled)
  → KMS / Key Protection (when applicable)
  → AES-256-GCM Decryption
  → Secure PDF Release
```

The frontend is a client interface only. All access checks, lifecycle transitions, storage access, cryptographic operations, and release decisions are made by the backend.

## 9. Security Architecture

- Passwords and MFA OTPs are hashed with bcrypt; plaintext values are not stored in user records.
- Login requires email/password validation followed by OTP verification before a JWT is issued.
- JWT authentication, active-account checks, token revocation, and role checks are enforced by backend middleware.
- Each uploaded PDF is encrypted with AES-256-GCM using a fresh per-paper data-encryption key and IV.
- SHA-256 is calculated over the stored ciphertext and checked before protected decryption.
- Local mode wraps the per-paper key with `QUESTION_PAPER_MASTER_KEY`; S3 mode uses AWS KMS-generated encrypted key material.
- The release endpoint validates role, locked state, schedule, ciphertext hash, and blockchain metadata when blockchain verification is enabled before it decrypts and returns a PDF.
- Audit events record security-relevant actions without storing PDFs, plaintext, passwords, tokens, or keys.

Blockchain stores integrity/audit metadata only. It does **not** store the PDF, plaintext, AES keys, DEKs, AWS credentials, application secrets, or blockchain private keys.

## 10. Project Structure

```text
.
├── frontend/                 React + Vite user interface
│   └── src/                  Layouts, pages, authentication context, and API client
├── backend/                  Express API and MongoDB application
│   ├── src/                  Controllers, middleware, models, routes, services, and scripts
│   └── test/                 Backend integration and regression tests
├── blockchain/               Hardhat contract, deployment script, and contract tests
├── .env.example              Safe environment-variable template
├── package.json              Root scripts and dependencies
└── README.md                 Project documentation
```

## 11. Installation Requirements

- Node.js and npm
- MongoDB running locally or a configured MongoDB connection string
- A modern browser
- Optional for S3 mode: an AWS configuration with a private bucket and KMS key
- Optional for blockchain mode: a local Hardhat node and deployed contract

## 12. Installation Steps

From `D:\Cloud-Computing -pro`:

```powershell
Copy-Item .env.example .env
npm run install:all
```

The repository includes `package.json` and `package-lock.json` files at the root and in its application modules. Keep lock files committed; do not commit `node_modules`.

## 13. Environment Configuration

Create the root `.env` locally from `.env.example`. It must never be committed.

For local encrypted storage, configure:

```dotenv
STORAGE_PROVIDER=local
QUESTION_PAPER_MASTER_KEY=<locally generated secret>
```

Generate a 32-byte Base64 master key locally without hardcoding or sharing its value:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

For S3/KMS storage, set `STORAGE_PROVIDER=s3` and configure `AWS_REGION`, `AWS_S3_BUCKET`, and `AWS_KMS_KEY_ID`. AWS credential values are required only for S3 mode and should be supplied through the standard AWS credential provider chain, not committed to source control.

For local blockchain development, configure placeholders with your own local values:

```dotenv
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
BLOCKCHAIN_PRIVATE_KEY=<local Hardhat account private key>
CONTRACT_ADDRESS=<deployed contract address>
```

Also configure MongoDB, a strong `JWT_SECRET`, and the local Admin seed variables in `.env`. Never copy real values into `.env.example`, frontend code, documentation, or Git history.

## 14. How to Run the Project

From `D:\Cloud-Computing -pro`, start the backend and frontend in separate terminals:

```bash
npm run dev --prefix backend
```

```bash
npm run dev --prefix frontend
```

URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`
- Health endpoint: `http://localhost:5000/api/health`

The Admin account is seeded from the root `.env` when needed:

```bash
npm run seed:admin --prefix backend
```

## 15. Complete User Workflow

1. An Admin account is seeded from local environment configuration; an Admin creates Exam Centre accounts.
2. A Question Setter registers, completes MFA, creates a draft, uploads a valid PDF, and submits it.
3. A Reviewer independently claims and approves or rejects the submitted paper.
4. A Security Officer independently claims and approves or rejects the reviewer-approved paper.
5. An Exam Authority independently claims and finally approves the security-approved paper. The paper becomes `LOCKED`.
6. The locking Exam Authority schedules a release time for the locked paper.
7. The Exam Centre sees only safe metadata for `LOCKED` papers in `SCHEDULED` or `RELEASED` release states.
8. Before the scheduled time, the Exam Centre cannot access the PDF. At or after the scheduled time, it requests the existing secure release endpoint.
9. The backend performs the applicable integrity, blockchain, key-protection, and decryption checks before returning the PDF.

## 16. Sample Input

Sample/demo workflow only; this does not claim that the sample PDF is included in the repository.

```text
Question Paper
Title: WEB
Exam: SEM-5
Subject: WEB-TECH
PDF: Abi-Web-12.pdf
```

The Question Setter submits the paper. The Reviewer and Security Officer approve it. The Exam Authority approves and locks it, then schedules its release. The Exam Centre accesses it after the scheduled time.

## 17. Sample Output

Sample/demo output:

```text
Status: LOCKED
Scheduled release: <example date/time>

After release
Status: RELEASED
Result: Secure PDF access granted after integrity and authorization checks.
```

## 18. API/module overview

| Module | Selected endpoints / purpose |
| --- | --- |
| Health | `GET /api/health` verifies backend availability. |
| Authentication | `/api/auth/register`, `/login`, `/verify-otp`, `/resend-otp`, `/logout`, and `/me`. |
| Administration | `/api/admin/dashboard/stats`, users, Exam Centres, and audit-log endpoints. |
| Question papers | Authenticated creation, upload, submit, revise, protected download, and secure `GET /api/question-papers/:id/release`. |
| Reviewer | Dashboard, eligible-paper queue, claim/decision, and review history endpoints. |
| Security Officer | Dashboard, claim/decision, and approval history endpoints. |
| Exam Authority | Dashboard, final claim/decision, approval history, and release scheduling. |
| Exam Centre | `GET /api/question-papers/exam-center` returns safe releasable-paper metadata only. |
| Blockchain | Hardhat contract and deployment tooling under `blockchain/`; it anchors integrity metadata, not document contents. |

## 19. Testing and Verification

Run the frontend production build:

```bash
npm run build --prefix frontend
```

Run backend tests:

```bash
npm test --prefix backend
```

Run the full backend regression serially from `backend/`:

```bash
node --test --test-concurrency=1 test/*.test.js
```

The suite covers authentication/MFA/RBAC, encrypted storage, approval workflow, scheduling, Exam Centre listing, secure release, and blockchain verification behavior.

## 20. Security Considerations

- Do not commit `.env`, database files, local encrypted artifacts, build output, logs, or `node_modules`.
- Keep the S3 bucket private and use least-privilege IAM permissions.
- Do not place secrets, KMS material, blockchain private keys, or PDFs in frontend code or blockchain contracts.
- Use local development OTP output only for development; production delivery needs an appropriate secure OTP channel.
- Treat backend authorization and release checks as the final authority; frontend controls are not security boundaries.

## 21. Important Notes

- MongoDB must be available locally or configured using environment variables; this repository does not include a database dump or database credentials.
- The Exam Centre list endpoint does not retrieve, decrypt, or expose PDF data. The secure release endpoint is the only PDF-release mechanism.
- Blockchain verification is configuration-dependent. When blockchain is disabled, the corresponding release path does not call blockchain verification.
- Generated Hardhat artifacts and frontend build output are reproducible and should not be committed.

## 22. Future Enhancements

- Production OTP delivery integration.
- Configurable notification reminders for scheduled releases.
- Paginated/filterable Exam Centre paper views.
- Deployment automation and infrastructure-as-code.
- Additional operational monitoring and audit reporting.
