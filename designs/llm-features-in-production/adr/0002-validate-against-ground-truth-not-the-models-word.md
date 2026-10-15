# ADR-0002: Validate against ground truth, not the model's word

- **Status:** Accepted
- **Date:** 2026-10-15
- **Applied in:** [ai-code-review-action ADR-0001](https://github.com/adilKhan72/ai-code-review-action/blob/main/docs/adr/0001-comment-only-on-diff-lines.md),
  [rag-docs-assistant ADR-0003](https://github.com/adilKhan72/rag-docs-assistant/blob/main/docs/adr/0003-citations-are-verified-not-trusted.md) (design),
  and the business checks in [loan-underwriting-ai](https://github.com/adilKhan72/loan-underwriting-ai)

## Context

Schema-constrained output guarantees the *shape* of an answer, not its truth. A model can return a perfectly typed
finding on a line that doesn't exist, a citation to a passage it never saw, or a net pay larger than gross pay.
Asking the model to double-check itself reduces some errors but uses the same unreliable judgement twice.

Most LLM tasks, though, have some ground truth available to ordinary code: the diff, the retrieved chunks, the
document's own totals, a reference list of valid codes.

## Decision

Every task defines **ground-truth checks** that run in code after schema validation, and output that fails them is
not passed downstream as if it were valid:

- **References must resolve.** Line numbers must be inside the diff's changed lines; citations must point at chunks
  that were actually retrieved for this request; ids must exist.
- **Values must reconcile.** Extracted amounts must satisfy arithmetic relationships (net ≤ gross; line items sum
  to totals within tolerance); dates must be plausible relative to the document date; codes must be in the official list.
- **Claims must be supported.** In RAG, each sentence with a factual claim carries a citation, and uncited claims are
  removed or the answer becomes "I don't know".
- On failure: drop the item (with a count), move it to a less trusted channel (a summary instead of an inline
  comment), retry once with the errors, or send the case to a human. Which one is a per-task decision, recorded with the task.

## Consequences

- Whole classes of hallucination become impossible to *ship*, even when they still happen.
- Each task needs someone to think about what its ground truth is. That's design work, and it's the most
  effective quality work available.
- Some correct outputs will be rejected by conservative checks. The dropped-item counts are tracked so the checks
  can be tuned.

## Alternatives rejected

- **Trust schema-valid output:** shape isn't truth.
- **Self-critique by the same model as the only check:** useful as an extra, not as the guarantee.

## Revisit when

A task has no checkable ground truth at all. Then it needs human review or a calibrated judge, and should be
treated as higher risk.
