# Schema-Driven Migration Plan

## Overview

This plan covers 4 improvements to the tenant schema management system to prepare for adding more tenants beyond the current two (mc, itp). Each phase eliminates a class of hardcoded assumptions, moving toward a fully schema-driven architecture.

## Summary

| Phase | Title | Effort | Priority | Dependencies |
|-------|-------|--------|----------|-------------|
| 1 | Eliminate hardcoded room logic | L | High | None |
| 2 | Add Zod schema validation | M | High | None |
| 3 | Simplify calendarId environment handling | M | Medium | None |
| 4 | Dynamic tenant registry | S | Medium | Phase 2 recommended |

**Recommended execution order:** Phase 2 → Phase 3 → Phase 1 → Phase 4

---

## Phase 1: Eliminate hardcoded room logic in mediaCommonsPolicy.ts

### Problem

`components/src/mediaCommonsPolicy.ts` contains hardcoded room ID lists specific to the Media Commons tenant. These duplicate information that already exists (or should exist) on the schema's `Resource` type. Adding a new tenant with different rooms requires modifying this file, defeating the purpose of a schema-driven system.

### Hardcoded lists → schema equivalents

| Constant | Room IDs | Schema Resource Field |
|----------|----------|----------------------|
| `SAFETY_TRAINING_REQUIRED_ROOM` | 103, 220, 221, 222, 223, 224, 230 | `resource.needsSafetyTraining` |
| `INSTANT_APPROVAL_ROOMS` | 221, 222, 223, 224, 233 | `resource.autoApproval` (minHour/maxHour !== -1) |
| `WALK_IN_ROOMS` | 103, 220, 221, 222, 223, 224, 230, 233 | `resource.isWalkIn` |
| `WALK_IN_CAN_BOOK_TWO` | 221, 222, 223, 224 | `resource.isWalkInCanBookTwo` |
| `CHECKOUT_EQUIPMENT_ROOMS` | 103, 220, 221, 222, 223, 224, 230, 233, 260 | `resource.isEquipment` |
| `CAMPUS_MEDIA_SERVICES_ROOMS` | 202, 1201 | `resource.services.includes("campus-media")` |
| `LIGHTING_DMX_ROOMS` | 220, 221, 222, 223, 224 | `resource.services.includes("lighting-dmx")` (new) |
| `MOCAP_ROOMS` | 221, 222 | `resource.services.includes("mocap")` (new) |
| `EVENT_ONLY_ROOMS` | 1201, 202 | Needs new field: `resource.roomCategory` |
| `MULTI_ROOMS` | 233, 103, 260 | Needs new field: `resource.roomCategory` |
| `PRODUCTION_ONLY_ROOMS` | derived | Needs new field: `resource.roomCategory` |
| `PRODUCTION_ROOMS` | derived | `roomCategory in ["production", "multi"]` |
| `EVENT_ROOMS` | derived | `roomCategory in ["event", "multi"]` |

### New Resource fields needed

Add to `Resource` type in `SchemaProvider.tsx`:

- `roomCategory?: "production" | "event" | "multi"` — for blackout period categorization

The `services` array already exists but needs two new values: `"lighting-dmx"` and `"mocap"`.

### Files that import from mediaCommonsPolicy

| File | What it imports | Change needed |
|------|----------------|---------------|
| `components/src/client/routes/booking/bookingProvider.tsx` | `SAFETY_TRAINING_REQUIRED_ROOM` | Already migrated to `room.needsSafetyTraining`. Remove dead import. |
| `components/src/client/routes/admin/components/policySettings/BookingBlackoutPeriods.tsx` | `EVENT_ROOMS`, `MULTI_ROOMS`, `PRODUCTION_ROOMS` | Derive categories from `resources.filter(r => r.roomCategory === ...)` via schema context. |
| `components/src/policy.ts` | `MEDIA_COMMONS_OPERATION_EMAIL` | Move email constants to tenant schema (`operationEmail` field) or a generic constants file. |
| `app/lib/sendHTMLEmail.ts` | `MEDIA_COMMONS_EMAIL` | Accept email from tenant schema as parameter. |
| `components/src/client/utils/useFakeDataLocalStorage.tsx` | `STORAGE_KEY_BOOKING` | Move to generic constants file. Not room-related. |
| `tests/unit/calendar-safety-ban-overlap-restrictions.unit.test.tsx` | `SAFETY_TRAINING_REQUIRED_ROOM` | Rewrite to test schema-driven behavior instead of hardcoded room IDs. |
| `tests/unit/BlackoutPeriods.room-categories.unit.test.tsx` | Room category constants | Update to use schema-derived categories. |

Also check (no direct import but hardcoded room IDs):

| File | Issue |
|------|-------|
| `components/src/client/routes/booking/components/BookingFormMediaServices.tsx` | Hardcodes `room.roomId === 103` and `room.roomId === 230` for staffing tech options. Use `room.staffingServices` instead. |
| `components/src/client/routes/booking/components/SelectRooms.tsx` | Commented-out `MOCAP_ROOMS` reference. Remove dead code. |

### Migration strategy

1. Add `roomCategory` field to `Resource` type in `SchemaProvider.tsx` with default in `defaultResource`
2. Populate `roomCategory` and `staffingServices` in existing MC tenant schema in Firestore
3. Run `syncTenantSchemas.ts` to propagate new field defaults to all tenants
4. Replace each import one file at a time (each can be an independent PR)
5. Once all imports are removed, delete `mediaCommonsPolicy.ts`

### Risk

- BlackoutPeriods UI uses predefined category radio buttons. If a tenant has no "production" rooms, those buttons are confusing. The UI should dynamically show only categories that exist in the tenant's resources.
- `staffingServices` field on `Resource` already exists but may not be populated. Must populate during migration.

**Effort: L** | **Dependencies: None**

---

## Phase 2: Add Zod schema validation

### Problem

The tenant schema is a complex nested object stored in Firestore with no runtime validation. A malformed schema (wrong type, missing field) can silently break the app.

### Proposed Zod schema (sketch)

```typescript
// components/src/schemas/tenantSchema.ts
import { z } from "zod";

const ResourceSchema = z.object({
  capacity: z.number(),
  name: z.string(),
  roomId: z.number(),
  isEquipment: z.boolean(),
  calendarId: z.string(),
  calendarIdProd: z.string().optional(),
  needsSafetyTraining: z.boolean().optional(),
  isWalkIn: z.boolean(),
  isWalkInCanBookTwo: z.boolean(),
  services: z.array(z.string()),
  autoApproval: z.object({
    minHour: z.object({ admin: z.number(), faculty: z.number(), student: z.number() }).optional(),
    maxHour: z.object({ admin: z.number(), faculty: z.number(), student: z.number() }).optional(),
    conditions: z.object({
      setup: z.boolean(), equipment: z.boolean(), staffing: z.boolean(),
      catering: z.boolean(), cleaning: z.boolean(), security: z.boolean(),
    }).optional(),
  }).optional(),
  // ... other fields
});

export const TenantSchemaSchema = z.object({
  tenant: z.string().min(1),
  name: z.string(),
  resources: z.array(ResourceSchema).min(1),
  agreements: z.array(z.object({ id: z.string(), html: z.string() })),
  emailMessages: z.object({ /* 12 message fields */ }),
  // ... all other fields matching SchemaContextType
});
```

### Where to validate

1. **`app/api/tenantSchema/[tenant]/route.ts` PUT handler** — Return 400 with Zod parse errors if validation fails
2. **`scripts/syncTenantSchemas.ts`** — Validate after `mergeSchemaDefaults` before writing to Firestore
3. **`app/[tenant]/layout.tsx`** — Optional: validate on read, log warnings but don't block rendering

### Edge cases

- Firestore sometimes stores arrays as objects with numeric keys (`{0: "ALT", 1: "MARL"}`). Use `z.preprocess` to normalize before validation.
- Empty strings are valid for some fields (e.g., `logo: ""`). Don't use `.min(1)` everywhere.
- The `__defaults__` property on arrays is a sync script construct, not stored in Firestore.

### Files to modify

- `components/src/schemas/tenantSchema.ts` — New file for Zod schema
- `app/api/tenantSchema/[tenant]/route.ts` — Add validation on PUT
- `scripts/syncTenantSchemas.ts` — Add post-merge validation

**Effort: M** | **Dependencies: None (benefits from Phase 1's `roomCategory`)**

---

## Phase 3: Simplify calendarId environment handling

### Problem

Each resource stores both `calendarId` (dev/staging) and `calendarIdProd` (production) in the same document. `applyEnvironmentCalendarIds` swaps the value at runtime based on `NEXT_PUBLIC_BRANCH_NAME`. This causes:

1. Every API route must remember to call the transform (currently **9+ locations**)
2. The schema editor needs `?raw=1` to avoid data corruption on round-trip
3. If `calendarIdProd` is missing in prod, it throws

### Current call sites for applyEnvironmentCalendarIds

1. `app/api/tenantSchema/[tenant]/route.ts`
2. `app/[tenant]/layout.tsx`
3. `app/api/bookings/route.ts`
4. `app/api/bookings/shared.ts`
5. `app/api/bookings/export/route.ts`
6. `app/api/syncCalendars/route.ts`
7. `app/api/syncSemesterPregameBookings/route.ts`
8. `app/api/cancel-processing/route.ts`
9. `components/src/server/admin.ts` (2 calls)

### Proposed solution

Dev, staging, and production already use **separate Firestore databases** (`(default)`, `booking-app-staging`, `booking-app-prod`). Each database should store only the correct `calendarId` for its environment.

### Migration steps

1. **Write one-time migration script:**
   - Production DB: copy `calendarIdProd` → `calendarId` for each resource
   - Dev/staging DB: keep current `calendarId` (already correct)
   - Remove `calendarIdProd` from all resources in all databases
2. **Update `SchemaProvider.tsx`:** Remove `calendarIdProd` from `Resource` type and `defaultResource`
3. **Delete `lib/utils/calendarEnvironment.ts`** entirely
4. **Remove all `applyEnvironmentCalendarIds` calls** from the 9+ locations
5. **Remove `?raw=1` hack** from schema editor and API route
6. **Update `schemaDefaults.ts`:** Remove `calendarIdProd` from defaults

### Risk

- **Data migration must happen before code deployment.** If new code is deployed before the production DB is migrated, production calendar IDs will be wrong.
- Verify no external tooling (Google Apps Script, etc.) reads `calendarIdProd` directly from Firestore.

**Effort: M** | **Dependencies: None**

---

## Phase 4: Dynamic tenant registry

### Problem

The valid tenant list is hardcoded in at least 3 locations:

- `scripts/syncTenantSchemas.ts`: `const TENANTS = ["mc", "itp"]`
- `components/src/client/routes/hooks/useTenant.tsx`: `const ALLOWED_TENANTS = ["itp", "mc"]`
- `components/src/constants/tenants.ts`: `TENANTS = { MC: "mc", MEDIA_COMMONS: "mediaCommons", ITP: "itp" }`

Adding a new tenant requires code changes and redeployment.

### Proposed solution

Derive the tenant list from Firestore by listing documents in the `tenantSchema` collection.

### Implementation

**A. Server-side tenant discovery**

```typescript
// lib/tenants.ts
export async function getRegisteredTenants(): Promise<string[]> {
  const snapshot = await db.collection("tenantSchema").listDocuments();
  return snapshot.map(doc => doc.id);
}
```

**B. Update `syncTenantSchemas.ts`**

```typescript
// Before
const TENANTS = ["mc", "itp"] as const;

// After
const tenantsToSync = options.tenant
  ? [options.tenant]
  : await getRegisteredTenants(db);
```

**C. Client-side validation**

The `[tenant]/layout.tsx` already validates against Firestore (returns 404 if schema doc not found). Keep a static `KNOWN_TENANTS` fallback for build-time, but accept any tenant whose schema exists at runtime.

**D. New tenant onboarding flow**

1. Super admin runs `npx ts-node scripts/syncTenantSchemas.ts --tenant <new-tenant> --database development`
2. Edit schema in admin UI to customize resources, policies, etc.
3. Run sync for staging and production
4. **No code changes or redeployment needed**

**E. Schema editor UI changes**

- Add "Add Tenant" button that creates a new schema document with defaults
- Existing per-tenant editor works unchanged

### Risk

- Accidentally creating a `tenantSchema/test` document would register it as a tenant. Mitigation: add `isActive: boolean` field, default `false` for newly created documents.
- Next.js `generateStaticParams` needs a static list at build time. If using ISR/dynamic rendering, this is not a problem.

**Effort: S** | **Dependencies: Phase 2 recommended**

---

## Recommended Execution Order

```
Phase 2 (Zod validation)     ← Protects against regressions in all other phases
  ↓
Phase 3 (calendarId cleanup) ← Independent, reduces complexity
  ↓
Phase 1 (hardcode removal)   ← Largest effort, highest impact. Split into sub-PRs per file.
  ↓
Phase 4 (dynamic tenants)    ← Quick win once the rest is done
```
