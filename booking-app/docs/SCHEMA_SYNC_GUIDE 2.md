# Tenant Schema Sync Guide

The tenant schema sync script ensures all tenant configurations in Firestore are synchronized with the authoritative default values defined in the codebase. This is essential when:

- Adding new fields to the tenant schema
- Ensuring all tenants have required fields with default values
- Updating default values for existing fields
- Maintaining consistency across development, staging, and production environments

## Usage

```bash
# Preview changes (dry run) - ALWAYS RUN THIS FIRST
npm run sync:schemas:dry-run

# Sync all tenants in development database
npm run sync:schemas

# Sync to staging database
npm run sync:schemas:staging

# Sync to production database
npm run sync:schemas:production
```

## How It Works

### 1. Authoritative Default Values

Default values are defined in `components/src/client/routes/components/SchemaProvider.tsx`:

- **`defaultScheme`** - Default values for the main schema (without tenant)
- **`defaultAgreement`** - Default values for Agreement objects
- **`defaultResource`** - Default values for Resource objects
- **`defaultStaffingSection`** - Default values for StaffingSection objects

### 2. Recursive Merge Process

The sync script uses a recursive merging algorithm that:

- **Preserves existing values** - Never overwrites data that already exists
- **Adds missing fields** - Automatically adds new fields with default values
- **Removes extra fields** - Removes keys that don't exist in the template (ensures schema matches template exactly)
- **Handles nested objects** - Recursively merges layer by layer, removing extra keys at all levels
- **Merges array items** - For arrays with `__defaults__`, merges defaults into each item and removes extra keys from array items
- **Skips arrays without defaults** - Uses existing array values as-is

### 3. Array Defaults with `__defaults__`

Arrays of objects use a special `__defaults__` property to enable automatic merging:

```typescript
agreements: defineObjectArrayWithDefaults(defaultAgreement),
resources: defineObjectArrayWithDefaults(defaultResource),
```

This allows the merge process to automatically apply defaults to each item in the array.
