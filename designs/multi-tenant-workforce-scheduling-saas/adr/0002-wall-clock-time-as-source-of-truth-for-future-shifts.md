# ADR-0002: Wall-clock time plus IANA zone is the source of truth for future shifts

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

"Store everything in UTC" is the usual advice, and it's right for events that have happened. A future shift is
different. It's an agreement that a person will be at a store at 09:00 *local time* on a date. Between publishing
and working that shift, time-zone rules can change (governments change DST rules, sometimes with weeks of notice).
If the shift were stored only as a UTC instant computed under the old rules, it would silently move to 08:00 or 10:00 local.

Labour rules also mix the two notions. Rest between shifts is measured in real elapsed time. "Per day" and "per week"
are local calendar concepts. Pay is for real hours worked, which differ from wall-clock differences on DST nights
(a 22:00–06:00 shift is 7 or 9 real hours).

## Decision

- **Scheduled (future) times** are stored as `local_date`, `start_local`, `end_local` (end may be on the next day)
  and the site's IANA `time_zone`. That is the source of truth.
- `start_utc` and `end_utc` are **derived** columns for indexing and overlap queries, stored with the `tzdb_version`
  used to compute them. When the platform deploys a new tz database, a job recomputes derived instants for future
  shifts in changed zones and notifies managers if any shift's real duration changed.
- **Actual events** (punches, approvals, exports) are UTC instants. Worked hours come from instants only.
- Shifts starting in a **skipped** local time are rejected. Shifts starting in a **repeated** local time require an
  explicit offset choice, defaulting to the first occurrence.
- **Rules** use instants for durations and rest, and the site's local calendar for day and week boundaries.
- Zones are always IANA names (`Europe/London`), never fixed offsets or abbreviations (`BST` is ambiguous).

## Consequences

- Future shifts keep their meaning across tz rule changes, and the system knows which rows to recompute.
- Two representations must be kept in sync. Only the scheduling service writes shifts, and it always derives the
  UTC columns in the same code path. A nightly check compares derived and recomputed values.
- DST behaviour is explicit and testable. The test suite has fixtures for both transitions in each supported region.
- Reporting must be clear about which time it uses (local calendar day for staffing reports, instants for pay).

## Alternatives rejected

- **UTC only:** silently wrong after a rule change; local-day rules need conversions everywhere.
- **Local time only, no zone:** can't compute real durations, rest periods or cross-zone comparisons.
- **Fixed UTC offset stored with each shift:** captures the offset at creation, which is exactly what goes stale.

## Revisit when

Never for the principle. The recompute job may need batching if a large region changes its rules with little notice.
