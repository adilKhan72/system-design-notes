# ADR-0003: Anchor the audit hash chain in write-once storage

- **Status:** Accepted
- **Date:** 2026-10-15
- **Builds on:** [loan-underwriting-ai ADR-0005](https://github.com/adilKhan72/loan-underwriting-ai/blob/main/docs/adr/0005-hash-chained-append-only-audit-trail.md)

## Context

Each application has an append-only audit chain. Every event stores
`hash = sha256(canonical_json(id, position, event, actor, data, prev_hash))`, and positions are unique per
application. Editing, reordering or deleting an event breaks verification. A trigger rejects `UPDATE` and `DELETE`.

That makes tampering *evident* only against someone who can't rewrite the whole chain. A database superuser can
disable the trigger, change an event, and recompute every later hash. The chain then verifies. For records that
may be examined years later, we want to prove that the trail we show is the one that existed at the time.

## Decision

1. A nightly job selects every application whose chain head changed in the last day, and builds a **Merkle tree**
   over `(application_id, position, hash)` of those heads, sorted by application id.
2. It writes the root, the leaf list and the job metadata to an object-storage bucket with **object lock in
   compliance mode**, with retention equal to the longest audit retention (7 years). Not even the account root can
   shorten or delete these objects during retention. An `audit_anchor` row records the day, root and object key.
3. Verification of an application recomputes its chain from PostgreSQL, then checks every anchored head for that
   application: the anchored `(position, hash)` must still be on the recomputed chain. A mismatch is a security incident.
4. Optionally, the daily root is also published somewhere outside our control (for example an RFC 3161 timestamping
   authority), which proves *when* the root existed.

## Consequences

- Rewriting history now requires tampering with write-once storage too, which the storage provider prevents
  during the retention period.
- There is a window of up to one day where recent events are protected only by the in-database chain. The job can
  run hourly if that window matters. Cost is a few small objects per run.
- Anchors contain ids and hashes only, no PII, so they are not affected by data-subject deletion. Deleting an
  applicant's PII from `applicant` doesn't touch the audit chain, because the chain never contained PII.
- Verification needs the anchor bucket to be readable, which adds a dependency to the audit tooling, not to the
  decision path.

## Alternatives rejected

- **Ledger database:** a managed one solves the same problem with more vendor lock-in, and at least one major
  managed ledger database has already been discontinued, which is a poor fit for 7-year records.
- **Public blockchain anchoring:** strongest public verifiability, but adds key management, fees and a compliance
  conversation for no gain over object lock plus an optional timestamping authority.
- **Signing every event with an HSM key:** proves which service wrote an event, but not that events weren't
  deleted or that the chain wasn't replaced. Complementary, not a substitute. Could be added later.

## Revisit when

A regulator or partner requires third-party-verifiable timestamps per event rather than per day.
