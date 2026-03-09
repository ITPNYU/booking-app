# XState Refactoring Plan

## Background

The current XState architecture has grown organically and is hard to follow:

- `xstateUtils.ts` (742 lines) — Legacy v4 code, **completely unused** (zero imports)
- `xstateUtilsV5.ts` (2,050 lines) — Current v5 orchestration, but too large and mixes concerns
- `mcBookingMachine.ts` (2,165 lines) — Pure state machine definition
- `xstateHelpers.ts` (117 lines) — State value extraction utilities
- `xstateUnified.ts` (117 lines) — Client-side state checker class
- `statusFromXState.ts` (120 lines) — XState to BookingStatusLabel mapping

Goal: Make the state machine the single source of truth for "what transitions exist and what happens," while keeping side effects cleanly separated and testable.

---

## Phase 1: Remove Dead Code (Low risk)

**Delete `xstateUtils.ts`**

- Zero files import from it (confirmed via grep)
- All API routes use `xstateUtilsV5.ts` exclusively
- Different `PersistedXStateData` interface (v4 format) — no migration needed since Firestore already uses v5 format

**Verification:**
- [ ] `grep -r "xstateUtils" --include="*.ts" --include="*.tsx"` shows no imports to the legacy file
- [ ] Full test suite passes after deletion
- [ ] Build succeeds

---

## Phase 2: Split `xstateUtilsV5.ts` by Responsibility (Medium risk)

The 2,050-line file currently handles four distinct concerns. Split into:

### `lib/stateMachines/xstatePersistence.ts` (~300 lines)
Firestore read/write for XState snapshots.

- `PersistedXStateData` interface
- `restoreXStateFromFirestore()` — restore actor from Firestore snapshot
- `createXStateDataFromBookingStatus()` — create initial XState data from legacy status
- `cleanObjectForFirestore()` — sanitize snapshot for Firestore
- `mapBookingStatusToXState()` — legacy status string to XState state mapping
- `getMachineForTenant()` — select MC vs ITP machine

### `lib/stateMachines/xstateTransitions.ts` (~400 lines)
Transition execution orchestration (the "controller" layer).

- `executeXStateTransition()` — main entry point: restore → send event → save
- `getAvailableXStateTransitions()` — list valid transitions for a booking

### `lib/stateMachines/xstateEffects.ts` (~600 lines)
Side effects triggered by state transitions.

- `handleStateTransitions()` — dispatch side effects based on old→new state
- Pre-approval updates (Firestore timestamp writes)
- Approval processing (finalApprove, email, calendar)
- Cancellation processing (email, calendar cleanup)
- Checkout/close processing
- Service approval/decline side effects

### `lib/stateMachines/xstateEmails.ts` (~200 lines)
Email notification logic, extracted from the effects file.

- `sendCanceledEmail()`
- Other email-related helpers currently embedded in handleStateTransitions

**Migration strategy:**
1. Create new files with functions extracted verbatim (no logic changes)
2. Re-export everything from a barrel `lib/stateMachines/index.ts` so external imports don't break
3. Update imports in API routes one by one
4. Delete re-exports from barrel once all imports are direct

**Verification:**
- [ ] Each new file compiles independently
- [ ] All existing tests pass without modification
- [ ] API routes work identically (no behavior change)

---

## Phase 3: Declare Side Effects in the Machine (Medium-high risk)

Move side effect *declarations* into `mcBookingMachine.ts` using XState v5's action pattern, while keeping implementations external.

### Before (current):
```typescript
// mcBookingMachine.ts — only knows about state transitions
states: {
  Approved: {
    on: {
      cancel: { target: "Canceled" },
    },
  },
}

// xstateUtilsV5.ts — has a giant if/else checking old→new state
if (newState === "Canceled") {
  await sendCanceledEmail(...);
  await handleCancelProcessing(...);
}
```

### After (target):
```typescript
// mcBookingMachine.ts — declares what should happen
states: {
  Approved: {
    on: {
      cancel: {
        target: "Canceled",
        actions: ["sendCancellationEmail", "handleCancelProcessing"],
      },
    },
  },
}

// xstateEffects.ts — implements the actions
export const mcBookingActions = {
  sendCancellationEmail: ({ context, event }) => { ... },
  handleCancelProcessing: ({ context, event }) => { ... },
};

// xstateTransitions.ts — wires them together
const actor = createActor(
  mcBookingMachine.provide({ actions: mcBookingActions }),
  { snapshot: restoredSnapshot }
);
```

**Benefits:**
- Reading the machine tells you the full story (transitions + what happens)
- Side effects are testable in isolation
- No more giant if/else state-matching in utils

**Risks:**
- XState v5 actions run synchronously by default; async side effects need careful handling
- Snapshot persistence format may change if actions are added to machine
- Need to verify that `machine.provide()` works correctly with restored snapshots

**Verification:**
- [ ] Create a test that runs each transition and verifies side effects are called
- [ ] Verify Firestore snapshot compatibility (old snapshots still restorable)
- [ ] Test in staging before production

---

## Phase 4: Consolidate Helper Layer (Low risk)

After Phase 2-3 are stable:

- Merge `xstateHelpers.ts` + `xstateUnified.ts` into a single `lib/stateMachines/xstateQueries.ts`
- Keep `statusFromXState.ts` as-is (clear single responsibility)
- Rename `xstateUtilsV5.ts` references if any remain

---

## Execution Order and Safety

| Phase | Risk | Behavior Change | Recommended Branch Strategy |
|-------|------|-----------------|-----------------------------|
| 1     | Low  | None            | Single PR, merge quickly    |
| 2     | Medium | None (pure refactor) | Single PR, thorough review |
| 3     | Medium-high | None intended, but touches core logic | Feature branch, test in staging, incremental PRs per state group |
| 4     | Low  | None            | Single PR after Phase 3 is stable |

### Safety Checklist for Each Phase
- [ ] All unit tests pass
- [ ] All E2E tests pass
- [ ] Build succeeds
- [ ] Manual smoke test on staging: create booking, approve, check-in, check-out
- [ ] Manual smoke test: cancel booking, verify email sent
- [ ] Manual smoke test: service approval flow (MC only)

---

## File Structure After Refactoring

```
lib/stateMachines/
  mcBookingMachine.ts       — State machine with action declarations
  itpBookingMachine.ts      — ITP state machine (simpler)
  xstatePersistence.ts      — Firestore snapshot read/write
  xstateTransitions.ts      — Transition execution orchestration
  xstateEffects.ts          — Side effect implementations
  xstateEmails.ts           — Email notifications
  xstateQueries.ts          — State value extraction and checking
  index.ts                  — Barrel exports

components/src/utils/
  statusFromXState.ts       — XState to BookingStatusLabel (unchanged)
```

Deleted:
- `xstateUtils.ts` (Phase 1)
- `xstateHelpers.ts` (merged in Phase 4)
- `xstateUnified.ts` (merged in Phase 4)
