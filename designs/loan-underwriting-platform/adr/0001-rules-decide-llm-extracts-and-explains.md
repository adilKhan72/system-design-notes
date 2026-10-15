# ADR-0001: Rules decide; the LLM only extracts and explains

- **Status:** Accepted
- **Date:** 2026-10-15
- **Implemented in:** [loan-underwriting-ai ADR-0001](https://github.com/adilKhan72/loan-underwriting-ai/blob/main/docs/adr/0001-rules-decide-llm-explains.md)

## Context

LLMs read inconsistent paystubs and bank statements far better than templates or regexes, and write clearer
explanations than string templates. But a lending decision must be:

- **reproducible**: the same inputs give the same outcome, years later, during a dispute or an examination;
- **explainable with specific reasons**: adverse action notices must state the principal reasons for a decline;
- **testable for fair-lending impact** before a policy change ships.

A model's output varies with sampling, model version and prompt wording. A provider can change model behaviour
under the same name. None of the three properties survives an LLM in the decision path.

## Decision

1. The LLM does two bounded jobs: **documents → structured fields** and **finished decision → prose**.
2. Extraction output is schema-constrained at generation time and re-validated (types, ranges, and business checks
   such as net pay ≤ gross pay). Invalid output gets one corrective retry, then becomes `needs_review`.
3. The decision is made by a **versioned, deterministic policy** over *facts* built only from validated extractions
   and the application form. Every rule runs (no short-circuit), and returns pass, refer or fail with a code and the
   values it used. Any fail → decline; else any refer → refer; else approve.
4. Low extraction confidence can **refer**, never **decline**. A model's uncertainty is never held against the applicant.
5. The decision row stores the policy version, the facts snapshot and every rule result. Replay means re-running the
   policy on stored facts.
6. Adverse action reasons are mapped from rule codes. The LLM may phrase the explanation, but the legally relevant
   reasons don't depend on it.

## Consequences

- The worst an LLM regression can do is produce a bad extraction (caught by validation, cross-checked by rules such
  as payroll deposit vs paystub net pay) or a poorly worded explanation. It can't flip a decision directly.
- Policy changes are code changes: reviewed, versioned, run in shadow on live traffic, then promoted.
- Extraction quality now shows up as refer rate, which is human cost. The metric to optimise is clear.
- We give up any lift a model-based score might add. If a statistical score is wanted later, it comes in as a
  separately validated model producing a *fact* (with its own version), not as an LLM judgement.

## Revisit when

A validated, monitored statistical model is approved under the model-risk process. It would enter as an input to
the rules, never by replacing them.
