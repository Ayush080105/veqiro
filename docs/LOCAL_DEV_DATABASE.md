# Local development database

`apps/server/.env` used to point `DATABASE_URL` at the production Neon database.
That is what turned a routine migration gap into a total login outage: Prisma
selects every scalar column by default, so the moment a column exists in
`schema.prisma` but not in the database, **every query on that model fails** —
including the `organization.findFirst()` better-auth runs on login. Nothing in
the app worked, not just the new feature.

The lesson is narrow and worth stating plainly: a Prisma **migration** can be
additive and safe to apply, while the **schema change that accompanies it** is
not safe to run against a database that has not had it applied yet. Code and
database have to move together, and the database has to move first.

## Setup

A local PostgreSQL 17 instance on `localhost:5432` is used for development.

```bash
# 1. Create the database (once)
psql -U postgres -c "create database veqiro_dev"

# 2. Point the server at it
#    apps/server/.env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/veqiro_dev

# 3. Create the schema
cd apps/server && npx prisma db push
```

`db push` rather than `migrate deploy`, because the migration history is not
replayable from an empty database — see below.

## Why `migrate deploy` does not work from scratch

Two independent reasons:

1. **`20260424000000_add_rag_chunks` needs pgvector.** The `vector` extension
   is not installed on a stock local Postgres. That table belongs to the Python
   service (`apps/ai` creates it at startup via asyncpg) and is not in
   `schema.prisma` at all, so Prisma does not need it.
2. **The history has drift.** A later migration drops `rag_chunks`, so skipping
   the first failure only moves the failure. Several migrations in this repo are
   hand-written for exactly this reason.

If you need the migration table populated, resolve the pgvector one as applied:

```bash
npx prisma migrate resolve --applied 20260424000000_add_rag_chunks
```

## Seeding a usable account

Sign-up requires email verification and Resend is not wired locally, so create
the user through the API and verify it directly:

```bash
curl -X POST http://localhost:5000/api/v1/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@veqiro.local","password":"devpassword123","name":"Dev User"}'
```

Then, in SQL: set `user."emailVerified" = true`, insert an `organization`
(with `onboarded = true`), a `member` row with role `owner`, one `entitlement`
per agent with status `ACTIVE`, and a `subscription` row.

The `subscription` row matters and is easy to miss: `TrialGateModal` gates on
`billing?.subscription != null`, not on entitlements, so without it an
otherwise fully-entitled org sits behind an unclosable "start your free trial"
dialog.

Do **not** hand-roll the password hash. better-auth's scrypt parameters are not
obvious and a wrong hash fails login with the same "Invalid email or password"
as a wrong password, which is a slow thing to debug.

## Verifying a migration before it ships

Migrations in this repo are hand-written, so they should be proven before they
reach a real database. Build the database at `main`'s schema, apply only the new
migration SQL, then diff:

```bash
# database at main's schema
git show main:apps/server/prisma/schema.prisma > prisma/schema.prisma   # temporarily
npx prisma db push
git checkout apps/server/prisma/schema.prisma                           # restore

# apply the new migrations by hand, then:
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
```

Exit code 0 and "No difference detected" means the migrations produce exactly
the schema the code expects.
