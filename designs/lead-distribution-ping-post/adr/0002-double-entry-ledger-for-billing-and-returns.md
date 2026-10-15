# ADR-0002: A double-entry ledger for charges, payouts and returns

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

Every sale moves money three ways: the buyer is charged the price, the publisher earns a payout (a fixed amount or a
revenue share), and the marketplace keeps the margin. Buyers can return leads within a window, which must reverse
all three. Prices and revenue shares change over time, and disputes arrive months later ("why was I charged for
these 14 leads on 3 March?").

A `balance` column per buyer and publisher, updated in place, can't answer that question, and a return becomes
an update that destroys history.

## Decision

- An append-only **ledger** of entries `(lead_id, account, amount_cents, kind, created_at)`, where each
  business event writes a set of entries that **sum to zero**: for a sale, a buyer receivable of +price,
  a publisher payable of −payout and revenue of −(price − payout).
- A return writes the **exact negation** of the sale's entries, referencing them. Nothing is ever updated or deleted.
- Each entry set has a unique idempotency key (`lead_id + kind`), so replaying `lead.sold` or a return request is a no-op.
- Balances, invoices and publisher statements are **projections**: sums over entries, cached per day, rebuildable at any time.
- The price and payout rule that applied are copied into the entries at the time of sale, so later price changes never
  rewrite history.

## Consequences

- Any figure on an invoice can be traced to specific leads and entries. Disputes become queries.
- Sum-to-zero is a checkable invariant: a nightly job verifies it per day and per lead, and also checks that every
  sold decision has exactly one charge set.
- More rows than a balance column (about 3 per sale, 1.8M/day), which is small for PostgreSQL with daily partitions.
- Invoicing and payouts run from projections. They're eventually consistent with sales, by the consumer lag (seconds).

## Alternatives rejected

- **Balance columns with an audit table:** the audit table becomes a ledger anyway, without the sum-to-zero invariant.
- **Billing entirely in a third-party billing system:** good for invoicing and collections, which it can still do
  downstream, but per-lead returns and revenue shares need lead-level granularity that subscription-billing tools don't model well.

## Revisit when

Payout scheduling, currencies or tax make an external ledger service worth its integration cost. The entry model stays the same.
