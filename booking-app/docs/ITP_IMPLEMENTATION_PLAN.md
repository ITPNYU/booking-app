# ITP Room Booking Implementation Plan

## Approach: Option A (Practical Extension)

MC and ITP workflows differ significantly, so we keep them explicitly separate and only share common parts. Scattered if/else checks will be consolidated using a registry pattern to prepare for future tenants.

---

## Phase 0: Firestore ITP Schema Data Setup

### Current State (development environment)
- `tenantSchema/itp` document exists
- Originally 9 rooms; now filtered to 5 Huddle Rooms (421, 422, 446, 447, 448)
- Google Calendar IDs: both dev and prod configured
- `supportVIP: false`, `supportWalkIn: false`
- `autoApproval`: all rooms disabled (minHour/maxHour = -1)
- `emailMessages`: mostly empty strings (`approvalNotice` only has test text)
- `roleMapping`, `programMapping`, `schoolMapping`: empty objects
- `agreements`: 1 item (bookingPolicy)

### Action Items
- [x] Fix `services: [""]` → `services: []` (all rooms) — done via updateItpHuddleRooms script
- [ ] Create `emailMessages` templates (ITP-specific copy) — waiting on PM
- [ ] Set up `roleMapping` / `programMapping` / `schoolMapping` or confirm not needed — waiting on PM
- [ ] Configure `autoApproval` rules per room/role — disabled for now
- [x] Fix missing `calendarIdProd` for room 448 — done via updateItpHuddleRooms script
- [ ] Enable `supportWalkIn` if needed — waiting on PM
- [x] Filter to Huddle Rooms only (5 rooms) — done via updateItpHuddleRooms script
- [x] Set 24-hour availability (startHour "00:00:00") — done via updateItpHuddleRooms script

---

## Phase 1: Foundation — Tenant Policy and Email Routing ✅ DONE

| # | Task | Target File |
|---|------|-------------|
| 1.1 | ✅ Create `itpPolicy.ts` (ITP operation email constants) | `components/src/itpPolicy.ts` |
| 1.2 | ✅ Create tenant policy registry (`getTenantPolicy(tenant)`) | `components/src/tenantPolicy.ts` |
| 1.3 | ✅ Make `getApprovalCcEmail` / `getCancelCcEmail` tenant-aware | `components/src/policy.ts` |
| 1.4 | ✅ Update all call sites | `xstateUtilsV5.ts`, `server/admin.ts`, `server/db.ts`, `bookingsDirect/route.ts` |

---

## Phase 2: Admin Panel ITP Support (Core Functionality) ✅ DONE

| # | Task | Details |
|---|------|---------|
| 2.1 | ✅ Fix approval action labeling | Added `Actions.APPROVE`, selection driven by `getTenantPolicy().approvalLevels` |
| 2.2 | ✅ Auto-close on checkout | ITP machine: `always` transition from Checked Out → Closed |
| 2.3 | ✅ Verify `useBookingActions` for ITP | Service actions gated by `isMediaCommons` — correctly hidden for ITP |

---

## Phase 3: Replace Hardcoded Room IDs with Schema-Driven Logic

| # | Task | Details |
|---|------|---------|
| 3.1 | Verify schema `resources` attribute coverage | `needsSafetyTraining`, `isWalkIn`, `autoApproval` already in schema |
| 3.2 | Add missing attributes (`roomCategory`, etc.) | Replace `MOCAP_ROOMS`, `EVENT_ONLY_ROOMS`, etc. |
| 3.3 | Create schema-based room query utilities | `roomPolicyUtils.ts` |
| 3.4 | Deprecate hardcoded arrays in `mediaCommonsPolicy.ts` | Email constants already moved to registry |

---

## Phase 4: Consolidate Scattered Tenant Conditionals (Registry Pattern)

| # | Task | Details |
|---|------|---------|
| 4.1 | Define `TenantCapabilities` interface | `approvalLevels`, `hasServiceRequests`, `autoCloseOnCheckout`, etc. |
| 4.2 | Replace `isMediaCommons()` / `isITP()` checks across 16 files | Keep checks that are genuinely MC-specific business logic |
| 4.3 | Extract MC-specific logic from `xstateUtilsV5.ts` | Separate MC service handling from shared transition logic |

---

## Phase 5: Walk-In / VIP Support

| # | Task |
|---|------|
| 5.1 | Verify and fix ITP walk-in booking flow |
| 5.2 | Confirm ITP schema `supportWalkIn` flag |
| 5.3 | VIP support (if needed) |

---

## Phase 6: Cron Jobs and Automated Processes

| # | Task |
|---|------|
| 6.1 | Verify auto-checkout processes ITP collections |
| 6.2 | Verify auto-cancel-declined works for ITP |
| 6.3 | Auto-close on checkout implementation (linked to Phase 2.2) |

---

## Dependency Graph

```
Phase 0 (Data setup) ← do first
  |
Phase 1 (Foundation)
  ├→ Phase 2 (Admin panel) → Phase 5 (Walk-in/VIP)
  ├→ Phase 3 (Schema-driven) → Phase 6 (Cron)
  └→ Phase 4 (Registry pattern) ← anytime after Phase 2
```

---

## Risks

- ITP `tenantSchema` data is incomplete (emailMessages empty, mappings empty)
- Legacy `xstateUtils.ts` coexistence — ITP must always use the v5 path
- ITP machine's `always` transition for auto-approval fires immediately — needs verification
- `xstateUtilsV5.ts` (2050 lines) mixes MC and ITP logic — needs separation in Phase 4

---

## Key Files

| File | Purpose |
|------|---------|
| `components/src/policy.ts` | Tenant-aware email CC routing |
| `components/src/tenantPolicy.ts` | Tenant policy registry |
| `components/src/mediaCommonsPolicy.ts` | Hardcoded MC room IDs |
| `components/src/client/routes/admin/hooks/useBookingActions.tsx` | Admin panel actions |
| `lib/stateMachines/itpBookingMachine.ts` | ITP state machine (347 lines) |
| `lib/stateMachines/mcBookingMachine.ts` | MC state machine (2165 lines, reference) |
| `lib/stateMachines/xstateUtilsV5.ts` | Shared XState utilities (2050 lines, needs splitting) |
| `app/api/bookings/route.ts` | Booking creation path |
| `scripts/syncTenantSchemas.ts` | Schema sync script |
| `components/src/client/routes/components/SchemaProvider.tsx` | Default schema definitions |
