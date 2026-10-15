# ADR-0003: Anonymised pings, and consent evidence that travels with the lead

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

A lead is personal data (name, phone, email, and for loans, financial details) collected with the consumer's
consent to be contacted. Two risks dominate:

1. **Over-sharing.** Parallel pings send each lead to about 20 buyers, of which one buys it. If pings included
   contact details, 19 buyers would hold personal data they never paid for and have no consent to use.
2. **Consent disputes.** Telemarketing-consent claims in the US can arrive years later and turn on the exact
   disclosure the consumer saw and the sellers it named. Without evidence tied to each lead, the marketplace and
   its buyers can't defend themselves, and buyers stop trusting the marketplace's leads.

## Decision

- **Pings are anonymised.** A ping contains only pricing attributes: product, state, ZIP prefix, amount band,
  credit band, lead age and a lead id. Contact details are sent **only in the post**, and only to the reserved winner.
- **Consent is captured as evidence at ingest**: the disclosure text (stored once and referenced by SHA-256), the
  sellers named, the timestamp, the page URL, the consumer's IP and user agent, and a third-party consent
  certificate id when the publisher provides one. The full record goes to write-once object storage, with
  retention of at least 4 years. Its hash is stored on the lead.
- **Consent is an eligibility filter.** A campaign is only eligible if its buyer is covered by the consent's named
  sellers (or by the disclosure's category language, per the vertical's policy). This works whether the
  regulation requires one-to-one consent or not; only the filter's configuration changes.
- **The post includes a consent reference** (record id and hash), so the buyer can retrieve the evidence in a dispute.

## Consequences

- 95% of buyer interactions carry no personal data. Breach impact at a buyer that never wins is minimal.
- Pricing is slightly less precise (no exact ZIP, no name), which buyers accept as industry practice.
- Ingest does more work per lead (hashing, an object write). The object write is asynchronous from the outbox, and
  doesn't sit on the sale's latency path. The hash is computed in-line.
- Consent wording changes are visible: a new disclosure hash appears in the data the same day.

## Alternatives rejected

- **Full lead in the ping, with contractual deletion by losing buyers:** common in older integrations, but relies
  on dozens of third parties deleting data they already have. Not acceptable for financial leads.
- **Storing consent as a boolean plus timestamp:** what many systems do. It can't answer "which sellers were named?",
  which is the question disputes turn on.

## Revisit when

A vertical's buyers can't price without a field that identifies the consumer. Then that vertical needs a
hashed or tokenised field, agreed per integration, not a return to full pings.
