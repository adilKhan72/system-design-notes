# ADR-0002: An AI gateway with token budgets, priorities and evaluated failover

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

At the target volume the platform sends about 600k input tokens per minute in a normal peak hour, and about 2.4M
in a campaign spike (see [capacity](../README.md#capacity-estimates)). Provider accounts have per-model rate limits
in requests and tokens per minute, and providers have outages. Several callers share that capacity: live document
extraction, explanations, underwriter re-runs, nightly evaluations and backfills.

If every service calls providers directly:

- a backfill can starve live applications of rate limit;
- retries from many workers amplify a provider incident (retry storms);
- each service re-implements provider SDKs, timeouts, structured-output quirks and cost accounting;
- nobody can answer "what did we send to which provider, under which prompt version" in one place.

## Decision

All model calls go through one internal **AI gateway** service, which is also the only network egress to model providers.

- **Interface by task, not by vendor.** Callers request `extract(document_type, text, schema_version)` or
  `explain(outcome, rule_codes)`. The gateway owns prompts, schemas and provider adapters. Prompts and schemas are
  versioned artefacts, and the versions are returned to callers and stored on every extraction.
- **Token budgets.** A token bucket per (provider, model), sized below the account limit. Each request is
  classed `live` > `review` > `batch`. `batch` traffic only uses capacity left over after `live` and `review`.
  Requests that can't get tokens wait on a queue with a deadline rather than failing.
- **Failover only to evaluated routes.** Each task has an ordered list of (provider, model, prompt version)
  routes. A route is only on the list if it passed the same labelled evaluation set as the primary,
  within an agreed tolerance. A circuit breaker per route moves traffic down the list. There is no silent
  fallback to "any model that answers".
- **Uniform guarantees.** Timeouts, retries with jittered backoff (honouring `Retry-After`), schema validation and
  one corrective retry live here, once.
- **Accounting.** Tokens, latency, cost and outcome per call, tagged by task, caller and prompt version, without
  request bodies in logs.
- **Caching.** Static instruction and schema prefixes use provider prompt caching. Identical requests (same input
  hash, prompt version and model) can be served from a response cache, which also makes evaluations cheap to re-run.

## Consequences

- Live traffic is protected from internal batch work, and provider incidents degrade into queueing.
- One place to change a model, roll a prompt version out gradually, or switch providers. Callers don't change.
- The gateway is critical-path infrastructure. It runs as stateless replicas, with the rate-limit state in Redis.
  If Redis is lost, it falls back to conservative per-replica local limits.
- An extra network hop (a few milliseconds) on calls that take seconds. Not significant.
- Keeping secondary routes evaluated has a real ongoing cost: every prompt change must be evaluated on every route.

## Alternatives rejected

- **Client-side SDK library in each service:** solves code reuse, not shared rate limits or priorities.
- **Third-party LLM proxy as-is:** good for routing and accounting, but evaluated-failover and task-level
  interfaces would still be ours to build. A reasonable base to build on, not a replacement for the decision.

## Revisit when

A single provider commits capacity well above our spike rate, or extraction moves to a self-hosted model where
the bottleneck becomes GPU capacity.
