# ADR-0003: Labour rules as versioned, effective-dated rule packs over coded rule types

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

The platform enforces rules from law (per jurisdiction), from tenant agreements, and from employee contracts.
Laws change on known dates. Tenants negotiate different thresholds and premiums. A rule check runs on every shift
edit, inside a 300 ms budget, and pay rules determine money in payroll exports that must be reproducible years later.

Most rules are instances of a few shapes: minimum rest between shifts, maximum hours in a window, required breaks,
overtime thresholds, notice periods and late-change premiums.

## Decision

- **Rule types are code.** Each is a pure, deterministic, unit-tested function over an employee's shifts or
  timesheet lines in a window, returning violations or pay adjustments with an explanation.
- **Rule packs are data.** A pack (`GB-WTR`, `US-CA`, `TENANT-123-AGREEMENT`) is a versioned set of rule-type
  instances with parameters and severities, and an `effective_from` date. Packs layer: law, then agreement, then
  contract, and a higher layer may only make a rule stricter or add premiums.
- **The effective version is chosen by the date of the work**, not the date of evaluation. Re-evaluating last
  year's shifts uses last year's pack.
- **Incremental on edit, full on publish and export.** On edit, only the changed employee's affected window is
  evaluated, using precomputed weekly totals for long reference periods.
- **Every evaluation result and every payroll export records the pack versions used.**
- **New pack versions run in shadow** against recent real schedules first. The diff in violations and pay is reviewed
  before activation.

## Consequences

- Legal changes are usually a new pack version with new parameters and a future effective date, deployable ahead of time.
- A genuinely new kind of rule needs a code change and a release, which is the right amount of friction for something that affects pay.
- Payroll is reproducible: same timesheets, same pack versions, same output.
- Tenants can configure but not program rules, so support can always explain an outcome.
- The precomputed weekly totals are a cache that must be maintained on every shift change (in the same transaction).

## Alternatives rejected

- **Hard-coded rules per jurisdiction in application code:** every threshold change is a release, and per-tenant
  variations become branches.
- **A general rules engine with a tenant-editable DSL:** flexible, but untestable tenant-authored logic ends up deciding pay.
- **Evaluating everything on publish only:** cheaper, but managers find out about problems at the end of planning, not while editing.

## Revisit when

Tenants need rule shapes we don't have often enough that the release cycle becomes the bottleneck.
