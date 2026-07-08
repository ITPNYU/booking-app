# Tenant schema backup (CLI)

Backs up Firestore **`tenantSchema`** documents into the **`tenantSchemaBackup`** collection—the same place **`syncTenantSchemas`** and **`copyCollection`** write before mutating schemas.

## Behavior

| Mode | What happens |
|------|----------------|
| **Default** (`npm run backup:tenant-schema`) | Writes one new document per tenant into **`tenantSchemaBackup`**, using `backupTenantSchemaDocument` / `backupTenantSchemaCollection` from `scripts/tenantSchemaBackup.js`. Backup type label in doc ids: **`cli-backup`**. |
| **`--dry-run`** | Does **not** write to Firestore. Exports JSON under **`scripts/output/tenant-schema-backup/<timestamp>/`** (same naming pattern as Firestore backup ids) plus **`manifest.json`** for inspection. |

## Prerequisites

- Run commands from the `booking-app` directory (where `package.json` lives).
- `.env.local` must define Firebase Admin credentials (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`), same as `npm run sync:schemas`.

## Usage

```bash
# Back up all tenantSchema docs → tenantSchemaBackup (development / default DB)
npm run backup:tenant-schema

# Dry run: write JSON locally only (no Firestore writes)
npm run backup:tenant-schema -- --dry-run

# Staging or production Firestore database
npm run backup:tenant-schema -- --database staging
npm run backup:tenant-schema -- --database production

# Single tenant (one backup document in tenantSchemaBackup)
npm run backup:tenant-schema -- --tenant mc

# With --dry-run only: optional output directory (default: scripts/output/tenant-schema-backup/<timestamp>)
npm run backup:tenant-schema -- --dry-run --output-dir ./my-preview
```

`--output-dir` applies only when **`--dry-run`** is set; it is ignored for real Firestore backups.

## Firestore backup ids

Real backups use the same id format as other tooling:  
`<tenantId>-backup-cli-backup-<timestamp>`  
(see `createBackupDocId` in `scripts/tenantSchemaBackup.js`).

## Local dry-run output

- Folder: `scripts/output/tenant-schema-backup/<backup-timestamp>/`
- Files: `<backupDocId>.json` (serialized Firestore types use `__firestore*` markers for readability)
- `manifest.json` lists tenants and files

`scripts/output/` is gitignored.

## Related

- [Tenant schema sync guide](./SCHEMA_SYNC_GUIDE.md)
- `scripts/tenantSchemaBackup.js`
- `scripts/syncTenantSchemas.ts` — uses backup type `sync-defaults`
- `scripts/copyCollection.js` — uses backup type `copy`

## Help

```bash
npm run backup:tenant-schema -- --help
```
