# ADR-0002: Quotes from local rate cards; live rate only at purchase

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

Customers compare carriers before paying, and requote several times as they add parcels or change options.
At peak that's about 100,000 quote requests a day, each across 4 carriers: 400,000 carrier rate calls, each
1–3 s and subject to rate limits. Quote latency target is p95 ≤ 1.5 s. Calling every carrier live for every quote
would miss the target whenever one carrier is slow, and would use up rate limits needed for label purchases.

Carrier prices are deterministic functions of published or negotiated data: zone charts by origin and
destination, weight breaks, dimensional-weight divisors, and surcharges (fuel, remote area, residential,
oversize), which change on known schedules.

## Decision

- **Quote locally.** A rating engine loads each carrier's rate card (zones, weight breaks, dimensional-weight rules,
  surcharges, fuel percentage) as versioned data with effective dates, refreshed daily and on carrier notices.
  A quote is computed in milliseconds, stores the `rate_card_version`, and expires after 30 minutes.
- **Verify at purchase.** After pack-out, re-rate with actual weight and dimensions, then call the carrier's live
  rate (or the label call returns the cost). If the live price is within a tolerance of the quote, the business absorbs
  the difference. If it's above, the customer approves the difference before the label is bought.
- **Monitor drift.** Every purchase records quote price vs carrier cost. A per-carrier drift dashboard and alert
  catch stale or wrongly loaded rate cards.
- **Duties and taxes** estimates use the same approach: destination thresholds and rates as effective-dated data.

## Consequences

- Fast, predictable quotes that work even while a carrier's rating API is down.
- Live API calls drop from about 400,000 to about 20,000 a day at peak, all on the purchase path.
- Someone owns rate card loading. It's a data pipeline with tests (known quotes per carrier as golden cases).
- Some quotes will be wrong (a surcharge the card missed). The tolerance and drift alerts bound the cost.

## Alternatives rejected

- **Live rates for every quote:** too slow at p95, burns rate limits, and fails when a carrier is degraded.
- **Cache live rates by (route, weight bracket):** better than nothing, but the key space is large (destinations ×
  weight × dimensions × services) and hit rates are low for long-tail destinations.

## Revisit when

A carrier stops publishing usable rate data (fully dynamic pricing). That carrier becomes live-only, with a shorter timeout and its own breaker.
