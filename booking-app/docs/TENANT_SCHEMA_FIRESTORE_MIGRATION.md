# Tenant schema Firestore shape migration

This guide covers **`scripts/migrateTenantSchemaFirestore.ts`**, which rewrites `tenantSchema/{tenantId}` documents in Firestore to the **canonical nested tenant schema** (for example `tenant.name`, `mappings.role`, `form.services`, `emailNotifications`, `origins.walkIn`).

Runtime reads already normalize legacy and new shapes via **`coerceTenantSchema`** (`lib/tenant/coerceTenantSchema.ts`). This script persists that normalized shape in the database so:

- Legacy top-level fields (`name`, `emailMessages`, `programMapping`, …) are **removed** after migration.
- Backups exist in **`tenantSchemaBackup`** before each destructive replace (unless you opt out).

This is different from **`npm run sync:schemas`**, which **adds missing keys** with defaults and uses `merge: true`. The migration script uses **`set(..., { merge: false })`** and replaces the whole document with the coerced JSON.

## Prerequisites

- From the **`booking-app`** directory (where `package.json` lives).
- **`.env.local`** with the same Firebase Admin variables used by other scripts (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`). See also [SCHEMA_SYNC_GUIDE.md](./SCHEMA_SYNC_GUIDE.md) if you use the schema sync flow.
- The **`npm run migrate:tenant-schema*`** scripts load **`tsconfig-paths/register`** so `@/` imports inside `coerceTenantSchema` resolve the same way as in the app.

## Commands

Dry run (no Firestore writes; writes preview JSON under `scripts/output/`):

```bash
npm run migrate:tenant-schema:dry-run
```

Same with explicit database (default is `development`):

```bash
npm run migrate:tenant-schema:dry-run -- --database staging
```

Apply migration (backs up each touched document, then replaces it):

```bash
npm run migrate:tenant-schema
```

Single tenant document id:

```bash
npm run migrate:tenant-schema -- --tenant mc --database production
```

## Flags

| Flag | Meaning |
|------|--------|
| `--dry-run` | Do not write to Firestore; emit `scripts/output/migrate-tenant-schema-{id}-{database}.json` previews. |
| `--database <env>` | `development` (default), `staging`, or `production` (same mapping as `syncTenantSchemas.ts`). |
| `--tenant <id>` | Only process `tenantSchema/<id>`. Default: all documents in the `tenantSchema` collection. |
| `--force-all` | Consider every document eligible even if it already looks nested with no stale legacy keys; still skips if coerced JSON is identical to stored JSON. |
| `--skip-backup` | Do **not** write to `tenantSchemaBackup` before replace. Not recommended. |

## What gets migrated

Coercion matches app behavior: flat fields map into nested structures (see `coerceTenantSchema` and `STALE_LEGACY_TOP_LEVEL_TENANT_SCHEMA_KEYS` in the same module).

By default, a document is migrated only if **`tenantSchemaFirestoreDocNeedsShapeMigration`** says so (legacy shape, `tenant` stored as a string, or nested document that still has stale top-level legacy keys). If nothing would change, the script **skips** the write.

## Suggested rollout

1. Run **`migrate:tenant-schema:dry-run`** against **development** and inspect `scripts/output/*.json`.
2. Run **`migrate:tenant-schema`** on development and smoke-test the app.
3. Repeat dry-run then apply for **staging**, then **production**, with the appropriate `--database` value.

## Related docs and scripts

- [SCHEMA_SYNC_GUIDE.md](./SCHEMA_SYNC_GUIDE.md) — syncing / merging default schema fields.
- `scripts/syncTenantSchemas.ts` — add-only merge of new defaults (does not remove legacy top-level keys by itself).
