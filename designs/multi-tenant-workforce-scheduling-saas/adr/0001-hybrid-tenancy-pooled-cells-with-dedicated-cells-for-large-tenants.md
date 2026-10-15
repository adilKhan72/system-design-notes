# ADR-0001: Hybrid tenancy: pooled cells with RLS, dedicated cells for large tenants

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

200 tenants, very unevenly sized: about 150 have fewer than 1,000 employees, and the 5 largest account for about
40% of all employees and data. Enterprise customers ask for isolation, per-tenant SLOs and sometimes data residency
or a dedicated database in their security review. Small customers need a low cost to serve. One engineering team
runs the platform.

The options were shared schema with `tenant_id`, schema per tenant, and database per tenant. The comparison is in
the [tenancy model](../README.md#tenancy-model) section.

## Decision

1. **One schema everywhere**, with `tenant_id` as the leading column of every primary key and index, and
   PostgreSQL row-level security on every tenant-owned table.
2. **Cells.** A cell is a regional deployment of the stateful components. Most tenants live in **pooled cells**.
   A tenant gets a **dedicated cell** (same schema, own database host) when any of these hold:
   it exceeds about 15% of a pooled cell's load, its contract requires it, or residency needs a region without a pooled cell.
3. **A tenant catalog** maps tenant → cell and region. The gateway routes on it. Services connect to the cell's
   database and set `app.tenant_id` per transaction. RLS policies use it.
4. **Tenant moves** between cells use logical replication of that tenant's rows, a short write freeze for the
   tenant, verification of row counts and checksums, then a catalog switch.
5. Migrations run cell by cell, in waves (canary cell first). The schema is backward compatible across one release,
   so cells can briefly be on different versions.

## Consequences

- Small tenants are cheap. Big tenants get isolation and their own maintenance windows, and their load can't hurt
  the pooled cells.
- The blast radius of a database incident is one cell.
- Because the schema is the same everywhere, a dedicated cell is an operational choice, not a fork. Moving a
  tenant is a data copy, not a migration.
- RLS adds a small per-query cost and needs discipline: superuser and table-owner roles bypass RLS, so
  application roles must be neither, and `FORCE ROW LEVEL SECURITY` is set on every table.
- Per-tenant restore from a pooled cell isn't possible from physical backups. Nightly logical per-tenant exports cover it.
- Cross-cell reporting (for us, not tenants) goes through the warehouse.

## Alternatives rejected

- **Schema per tenant:** N migrations with partial failure states, plus catalog bloat and pooling problems, and
  still no resource isolation.
- **Database per tenant for all:** strong isolation, but the idle cost and fleet tooling don't pay off for small
  tenants, which are most of the customer count.
- **Shared schema with application-only filtering (no RLS):** one missing `WHERE tenant_id` is a breach. RLS turns
  that bug into an empty result.

## Revisit when

The number of dedicated cells passes about 20. At that point fleet tooling (provisioning, migrations, monitoring per
cell) needs to be a product of its own, or a distributed PostgreSQL sharded by `tenant_id` becomes the simpler option.
