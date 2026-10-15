# ADR-0003: An append-only custody ledger for physical parcels

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

The service holds other people's property. The most expensive support cases are "you lost my parcel", "it arrived
damaged", and "the box was lighter than what I bought". Answering them needs a history: when it arrived, its
weight and photos at intake, every location it was in, who picked and packed it, what the box weighed when it left.

The warehouse also needs to keep working when the connection to the cloud is down, which means writes happen in
two places and must merge.

## Decision

- Every physical action is a **scan** recorded as an immutable `custody_event`: received, photographed, stored at
  a location, moved, picked, packed into a shipment, weighed, handed over to a carrier, returned, disposed.
  Each has an actor, a station, a timestamp, and the weight where measured.
- Event ids are generated at the station (ULIDs), so the warehouse edge node and the core can exchange events
  idempotently and in any order.
- A parcel's current status and location are **derived** from its latest events (and stored as a projection for
  queries). Nobody edits the location directly. A correction is a new event with a reason.
- Weight is captured at intake and again at pack-out. Pack-out compares the sum of parcel weights (plus packaging)
  with the box weight, and flags a discrepancy above a threshold before the label is bought.

## Consequences

- Claims and disputes are answered from data: the chain of scans, photos and weights, with named staff.
- The edge node and the core converge without conflict resolution logic, because events are immutable and unique.
- Missing scans become visible operationally (a parcel picked but never packed), and drive process fixes.
- More rows (about 8 events per parcel, 480,000 a day at peak), which is small and partitioned by month.
- Staff must scan at every step. Station software makes the scan the action (the next screen appears on scan),
  so skipping it is harder than doing it.

## Alternatives rejected

- **A mutable status and location on the parcel only:** smallest model, no history, and offline merge conflicts.
- **Full event sourcing for every aggregate:** custody is where the history matters. Shipments and payments are
  modelled as state machines with their own audit, which is simpler.

## Revisit when

RFID or computer-vision tracking replaces manual scans. The ledger stays, with machine actors.
