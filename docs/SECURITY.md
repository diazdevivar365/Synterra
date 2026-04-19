# Security

## Reporting a vulnerability

- **Email**: `security@forgentic.io`
- **PGP key**: Published at `https://forgentic.io/.well-known/security.txt` (pending W0-3).
- **Do not report via GitHub issues.** For coordinated disclosure, email the address above and we
  will acknowledge within one business day.

## Threat model

The full threat model, mitigations, and compliance roadmap are maintained in
[`PLAN.md §J`](../PLAN.md).

## Encryption baseline

TLS 1.3 is required for every ingress and every cross-plane hop between Synterra and Aquila. Postgres
(RDS in Phase 1) is encrypted at rest with AWS-managed keys; object storage buckets use
SSE-KMS. Tenant isolation is enforced at the database layer with Postgres row-level security policies
keyed off the session-scoped `app.current_org_id` setting — application-level filtering is
defence-in-depth, never the sole gate.
