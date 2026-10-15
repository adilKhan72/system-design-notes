# ADR-0001: Ping all eligible buyers in parallel; reserve the cap only at post time

- **Status:** Accepted
- **Date:** 2026-10-15
- **Extends:** [lead-routing-engine ADR-0004](https://github.com/adilKhan72/lead-routing-engine/blob/main/docs/adr/0004-ping-post-timeouts-fallback.md), which chose sequential ping-post and deferred this mode

## Context

Sequential ping-post tries buyers in order of a *fixed* price and posts to the first that accepts. That works
while prices are fixed. Most large buyers bid dynamically: the price depends on the lead (state, amount, credit
band) and on their own real-time appetite, so it's only known after a ping. With about 20 eligible campaigns, a
300 ms ping timeout and a 2 s budget, sequential pinging can try about six buyers in the worst case, and the
marketplace sells to whoever accepts first rather than whoever pays most.

Two questions follow: ping in parallel? And when to reserve the buyer's cap?

## Decision

1. **Ping every eligible campaign in parallel** with one shared deadline (300 ms by default; a campaign's own
   timeout can only be shorter). Eligibility includes a cap-headroom *hint* from the config cache, so campaigns that are
   obviously full aren't pinged.
2. **Rank** responses by bid (fixed-price campaigns bid their price), then by weighted random within ties
   (Efraimidis-Spirakis keys, as in the repo).
3. **Reserve only for the bidder about to be posted**, using the same single-statement conditional upsert as the
   repo. If the reservation fails (the cap filled during the auction), move to the next bidder; no network call
   is wasted.
4. **Post** to the reserved bidder with the `bid_id` it returned. On reject, timeout or error, release the
   reservation and continue down the ranked list until the overall budget runs out.

## Consequences

- The best price wins within one round trip: the revenue per lead improves, and worst-case latency is
  `ping deadline + k × post timeout` instead of `n × ping timeout`.
- No cap is ever exceeded: the authoritative check is still the reservation right before the post.
- A buyer can be pinged, bid, and then be skipped because its cap filled meanwhile. That's a wasted ping, which
  is cheap, and it's visible in the attempt record as `cap_full_after_bid`.
- Outbound load is about 20× the lead rate (2,800 pings/s in a burst), so a dedicated ping gateway with per-host
  pools and circuit breakers is needed.
- Buyers see pings for leads they won't get. Ping volume is part of the integration contract, and buyers can set
  a maximum ping rate per campaign.

## Alternatives rejected

- **Reserve at ping time for every pinged campaign:** correct, but holds up to 20 slots per sale. Near cap limits,
  most of a buyer's remaining slots would be tied up in auctions it then loses, so buyers under-fill.
- **Second-price auction:** better incentives in theory, but most buyer integrations expect to pay what they bid.
  It's a commercial decision, not an architectural one; the ranking step can switch pricing rules per vertical.

## Revisit when

Buyers' ping-volume limits make parallel pings to everyone impractical. Then ping the top-k by historical
win-rate-weighted price, and keep the rest as a sequential tail.
