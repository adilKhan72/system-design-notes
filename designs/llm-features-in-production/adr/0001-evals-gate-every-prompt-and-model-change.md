# ADR-0001: Evals gate every prompt and model change

- **Status:** Accepted
- **Date:** 2026-10-15
- **Applied in:** [rag-docs-assistant ADR-0004](https://github.com/adilKhan72/rag-docs-assistant/blob/main/docs/adr/0004-retrieval-evals-gate-ci.md) (design; implementation planned),
  and the fixture provider in [loan-underwriting-ai](https://github.com/adilKhan72/loan-underwriting-ai)

## Context

An LLM feature's behaviour depends on four things that change independently: the prompt, the output schema, the
model, and the input distribution. A one-word prompt edit can move accuracy by several points on some class of
input. Code review can't see that, because the diff is text and the effect is statistical.

Unit tests that call a real model are slow, cost money, are flaky, and still don't measure quality. Tests that
mock the model measure nothing about quality at all.

## Decision

Split the two concerns:

1. **Deterministic tests** use a **fixture provider**: recorded model outputs keyed by a hash of
   (prompt version, input, schema). They test everything around the model (pre-processing, validation, retries,
   mapping) for free and deterministically. A prompt change changes the hash, so fixtures must be re-recorded and
   the new outputs appear in the pull request diff for review.
2. **Evals measure quality.** Each task has a versioned golden set with expected outputs. The eval runner computes
   task-appropriate metrics (field-level exact match, accuracy, recall@k, citation validity), compares them with the
   main branch's baseline, and **fails CI** on a regression beyond an agreed tolerance. It runs on any change to
   prompts, schemas, model ids or routes, and nightly against production routes to catch provider-side changes.
3. LLM-as-judge is used only for qualities without ground truth (tone, helpfulness), and its agreement with human
   labels is measured before its scores gate anything.

## Consequences

- Prompt changes are reviewed with evidence: metric deltas and per-case diffs.
- The golden set becomes the most valuable artefact of the feature. It needs an owner, versioning, and a process
  for adding production failures to it.
- Evals cost money and need provider credentials in CI (a protected environment). At about $10 a run for 500 cases
  across three routes, that's not a reason to skip them.
- Small golden sets have noisy metrics. Tolerances must reflect that, and the set should grow over time.

## Alternatives rejected

- **Manual spot checks before release:** don't scale, aren't repeatable, and miss regressions on rare inputs.
- **Real-model unit tests:** slow, flaky, costly, and still not a quality measure.

## Revisit when

Never for the principle. The tooling (a hosted eval platform vs our runner) can change.
