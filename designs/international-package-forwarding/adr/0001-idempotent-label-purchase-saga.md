# ADR-0001: Idempotent label purchase as a saga with reconciliation by carrier reference

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

Buying a label is a paid call to a third party. Each carrier API creates a shipment and returns a tracking number
and label, and bills the account for it. Three things make this dangerous:

1. **Ambiguous outcomes.** A timeout or a `502` can mean the label was never created, or created and the response lost.
   Retrying blindly can buy two labels. Not retrying can leave a paid shipment without a label.
2. **Uneven idempotency support.** Some carrier APIs accept an idempotency key. Others only accept a free-text
   customer reference that can be searched later. A few have neither, but allow voiding a label within a window.
3. **Money on both sides.** The customer's payment and the carrier's charge must line up: no label without payment,
   no captured payment without a label.

## Decision

Model the purchase as a **saga** with a persistent `label_attempt` per try:

1. **Pre-condition:** the payment is *authorised* (not captured) and the shipment is packed and re-rated.
2. **Start:** insert a `label_attempt` in state `pending`. A partial unique index allows only one attempt per shipment in
   `pending`, `purchased` or `unknown`. The attempt id is the idempotency key where the carrier supports one, and the
   shipment reference where it doesn't.
3. **Call the carrier**, with a timeout and a lease on the attempt (so a crashed worker's attempt can be picked up).
4. **Outcomes:**
   - success → `purchased` (tracking number, label file, cost stored) → capture the payment;
   - definite failure (a validation error) → `failed`, shown to the customer or ops, and a new attempt may start;
   - ambiguous (timeout, 5xx, connection reset) → `unknown`.
5. **Resolve `unknown` before anything else:** retry with the *same* idempotency key where supported, or search the
   carrier by reference. Found → `purchased`. Confirmed absent → retry with the same attempt id. Still unresolvable
   after N tries → manual queue, alerting at 15 minutes.
6. **Compensations:** if capture fails, void the label within the carrier's void window and void the authorisation.
   If no label is bought within a deadline, void the authorisation.
7. **Nightly reconciliation** of carrier invoices against `label_attempt` rows. Any billed label without a matching
   purchased attempt is voided or disputed.

## Consequences

- A retry can't produce a second paid label through our code, and the residual risk (a carrier that ignores the
  reference) is caught by reconciliation within a day and usually recoverable by voiding.
- The customer's card is only charged for a shipment that has a label.
- More states than a simple "call and save": `unknown` is a real state with its own alert, and support needs a view of it.
- Carrier adapters must implement three operations (create, find by reference, void), not one. Where a carrier lacks one,
  the adapter documents the gap and reconciliation covers it.

## Alternatives rejected

- **Retry on timeout without lookup:** buys duplicate labels in exactly the conditions (carrier degradation) where it's most likely.
- **Capture first, then label:** simpler, but every label failure becomes a refund with fees, and final weight
  isn't known at checkout.
- **Distributed transaction across PSP and carrier:** not available, and wouldn't help with ambiguous network outcomes anyway.

## Revisit when

A label aggregator with strong idempotency guarantees becomes the only path to carriers. The saga stays, with
fewer adapter cases.
