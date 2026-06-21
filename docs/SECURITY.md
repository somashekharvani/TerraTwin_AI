# TerraTwin AI - Security Policies

This document details the security principles, configuration, and controls applied across the TerraTwin AI platform.

---

## 1. Authentication & Session Management
- **Password Hashing**: Done using `bcryptjs` with a work factor of 10 rounds. Raw passwords are never stored.
- **JWT Authentication**: User logins issue a JSON Web Token (JWT) signed with `HS256`.
  - Tokens expire after 7 days (`7d`).
  - Stored in standard Bearer headers for APIs.

---

## 2. API Security Controls
- **Rate Limiting**: Implemented via `express-rate-limit`. Public API endpoints (like authentication and scans) are capped at 100 requests per hour per IP.
- **Input Validation**: All incoming requests are validated against strict TypeScript `Zod` schemas before executing controllers. This prevents malformed payloads and injection vector attempts.
- **Security Headers**:
  - `helmet()` middleware is integrated to configure secure HTTP headers (XSS Filter, HSTS, Content Security Policy, Frame options).
  - Explicitly disabled the `X-Powered-By` header to hide software signatures.
- **Database Safety**: Prisma ORM is utilized for all database interactions. Prisma uses parameterized queries by default, protecting the database layer from SQL Injection.

---

## 3. Data Privacy & Local Image Extraction
- **Zero Storage on Server**: Uploaded electricity/gas bills and meal images are processed in-memory. After extracting carbon footprint metrics using Google Gemini Vision, the temporary files or image buffers are immediately discarded.
- **No Extra Permissions**: The application explicitly avoids requesting SMS, contacts, email sync, or banking permissions to maintain compliance with strict privacy audits.
- **GDPR Compliance**: Users can delete their account at any time, which cascade-deletes all associated `CarbonEntry` and `TokenTransaction` records.
