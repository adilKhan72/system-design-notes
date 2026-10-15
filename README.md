# system-design-notes

System-design write-ups for the kinds of systems I have designed and led as a software architect: lending and
underwriting, real-time lead marketplaces, multi-tenant B2B SaaS, and cross-border e-commerce logistics. Each one
has requirements with numbers, capacity arithmetic, diagrams, failure modes and the decisions I'd defend in a
design review. Each one also says what I'd do differently at the next order of magnitude.

These are **clean-room, generic designs**. They come from first principles and public knowledge, not from any
employer's code, documents or data. Product names, client names and internal numbers are deliberately absent.
Where a design has a working implementation in one of my public repos, the write-up links to it and stays
consistent with it.

## Index

| Design | What it's about | Related code |
|---|---|---|
| [Loan underwriting platform](designs/loan-underwriting-platform/README.md) | Document AI, a deterministic rules engine, PII redaction, a hash-chained audit trail | [loan-underwriting-ai](https://github.com/adilKhan72/loan-underwriting-ai) |
| [Lead distribution (ping-post)](designs/lead-distribution-ping-post/README.md) | A real-time lead marketplace: sub-second auctions, buyer caps, effectively-once sales | [lead-routing-engine](https://github.com/adilKhan72/lead-routing-engine) |
| [Multi-tenant workforce scheduling SaaS](designs/multi-tenant-workforce-scheduling-saas/README.md) | Tenancy models, shift scheduling, time zones and DST, labour-law rules, payroll exports | n/a |
| [International package forwarding](designs/international-package-forwarding/README.md) | Parcel intake, consolidation, carrier rate shopping, customs data, idempotent label purchase | n/a |
| [LLM features in production](designs/llm-features-in-production/README.md) | An architect's checklist: providers, structured output, evals, guardrails, PII, cost, fallbacks | [loan-underwriting-ai](https://github.com/adilKhan72/loan-underwriting-ai), [ai-code-review-action](https://github.com/adilKhan72/ai-code-review-action), [rag-docs-assistant](https://github.com/adilKhan72/rag-docs-assistant) |

Each write-up landed as its own pull request, so the history shows how each one was reviewed.

## How each write-up is structured

Every design in `designs/<slug>/` follows the same outline, so they can be compared and skimmed:

1. **Problem and requirements.** Functional, then non-functional with explicit numbers. Every number is an
   assumption, and the write-up says so. The point is to make the arithmetic and the trade-offs concrete.
2. **Capacity estimates.** The arithmetic is shown, so you can change an input and redo it.
3. **High-level architecture.** A mermaid diagram and a table of components and their responsibilities.
4. **Data model.** The tables or documents that matter, with keys and the constraints that carry the guarantees.
5. **Key flows.** Mermaid sequence diagrams for the paths that matter.
6. **Scaling and bottlenecks.** What breaks first, and what to do about it then (not before).
7. **Failure modes.** What fails, how it's detected, what the system does about it.
8. **Consistency and idempotency.** Where the system is strongly consistent, where it's eventually consistent, and why.
9. **Security and compliance.** Threats, data classification, the regulations that shape the design.
10. **Observability.** The SLIs, the dashboards and the alerts I'd want on day one.
11. **Trade-offs considered and rejected.** Alternatives, and why they lost *for these requirements*.
12. **ADRs.** Two or three Architecture Decision Records in `designs/<slug>/adr/`
    (context, decision, consequences, and what would make us revisit it).

## Conventions

- Numbers are round on purpose. "About 50 writes/s at peak" is more useful in a design review than false precision.
- "Effectively-once" means at-least-once delivery plus an idempotent consumer. Nothing in these designs claims
  exactly-once delivery across a network.
- Money is integer minor units (cents/pence) with an ISO 4217 currency code. Times are stored in UTC, and the
  IANA time zone is stored next to anything a human schedules.
- Diagrams are mermaid, so they render on GitHub and diff in review. CI parses every diagram.

## Checks

CI lints the Markdown ([markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2)), parses every mermaid
block with the real mermaid parser under a DOM shim (no headless browser), and checks every link and anchor with
[lychee](https://github.com/lycheeverse/lychee).

```bash
npm ci
npm run check            # markdownlint + mermaid parse
lychee --config lychee.toml './**/*.md'
```

## Licence

The write-ups and diagrams are licensed under [CC BY 4.0](LICENSE). You can reuse them with attribution.
The small amount of tooling in `scripts/` is under the same licence.
