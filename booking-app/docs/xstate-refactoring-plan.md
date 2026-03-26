# XState Refactoring Plan

## Goal

Refactor XState code so that:

1. **State machines are the single source of truth** — all booking logic is expressed in the machine definition
2. **Side effects are pluggable** — email, calendar, DB writes are wired outside the machine
3. **New features (e.g., revoke) are easy to add** — clean structure makes changes straightforward

## Why Not Stately Studio for PM-Driven Changes

We evaluated using Stately Studio so PMs could visually add/modify states without touching code. This is **not practical** for this project:

1. **Adding a state always requires code changes.** Every new state needs action implementations (email templates, DB field updates, calendar integration, API routes). Stately can wire action names visually, but a developer must write the implementation. PM-only changes never fully work.

2. **MC's parallel states are too complex for visual editing.** 6 services × 3 states = 18 parallel substates. The Stately visual editor becomes unusable at this scale.

3. **Round-trip editing breaks factory-generated states.** Phase 2 uses a factory to reduce 1,300 lines of duplication. Stately exports flat state definitions, so the factory structure is lost on import.

4. **Maintenance overhead.** The team would need to maintain Stately compatibility, manage export/import drift, and learn the tool — all for a workflow that still requires code changes every time.

### Alternative: AI-Assisted Development (Vibe Coding)

The PM's actual goal is "change business logic without deep code knowledge." AI tools (Claude Code, Codex, etc.) achieve this better than Stately:

- **Natural language instructions** — "Add a revoke event that undoes approval and sends an email" generates machine changes + actions + API + tests in one pass
- **Covers the full stack** — Stately only handles the state machine. AI handles email templates, DB schemas, UI buttons, and tests too
- **No tool lock-in** — AI tools are interchangeable. Stately deprecation/pricing changes would require migration
- **Works with messy code** — AI reads the existing codebase and adapts. Stately requires specific code structure

The refactoring in this plan (Phases 0-2) makes the codebase **easier for both humans and AI to modify**, which is the right investment regardless of tooling choice.

## Current State

| File | Lines | Problem |
|------|-------|---------|
| `xstateUtilsV5.ts` | 2,001 | God Object — orchestration, persistence, side effects, migration all in one |
| `mcBookingMachine.ts` | 1,939 | 6 identical service state structures (~1,300 lines of duplication) |
| `itpBookingMachine.ts` | 347 | Relatively clean but guards have heavy logging |
| `statusFromXState.ts` | 119 | OK |
| **Total** | **4,287** | |

### Key Problems

1. **`handleStateTransitions()` is 702 lines** — a massive if-else chain that mixes state detection, Firestore writes, email sending, and calendar updates
2. **Email sending duplicated 3x, calendar updates duplicated 4x** across different state handlers
3. **MC machine has ~1,300 lines of copy-paste** for 6 service types (staff, equipment, catering, cleaning, security, setup)
4. **Magic strings** for state names and event types — no single source of truth
5. **Side effects are embedded in the orchestration layer**, not declared in the machine — Stately can't see or manage them
6. **No tests** for `executeXStateTransition()` or side effect coordination
7. **26+ dynamic imports** scattered throughout for circular dependency workarounds

### File Inventory and Dead Code

XState 関連コードは **6ファイル、4,635行** に散在:

| File | Lines | Role | Status |
|------|-------|------|--------|
| `lib/stateMachines/xstateUtilsV5.ts` | 2,001 | Orchestration, persistence, side effects | Active (2 public exports) |
| `lib/stateMachines/mcBookingMachine.ts` | 1,939 | MC state machine definition | Active |
| `lib/stateMachines/itpBookingMachine.ts` | 347 | ITP state machine definition | Active |
| `components/src/utils/statusFromXState.ts` | 119 | XState → BookingStatusLabel mapping | Active |
| `components/src/utils/xstateHelpers.ts` | 116 | Read-only XState query helpers | Partially dead |
| `components/src/utils/xstateUnified.ts` | 116 | Re-exports + XStateChecker class | Partially dead |

#### xstateUtilsV5.ts — Only 2 functions are actually imported externally

| Export | External Usage |
|--------|---------------|
| `executeXStateTransition()` | 4 API routes + 1 test |
| `getAvailableXStateTransitions()` | 1 API route |
| `createXStateDataFromBookingStatus()` | Internal only |
| `restoreXStateFromFirestore()` | Internal only |
| `PersistedXStateData` (interface) | Internal only |

The 3 internal-only exports should not be exported.

#### xstateHelpers.ts — 2 of 5 functions are dead

| Function | Usages | Status |
|----------|--------|--------|
| `getXStateValue()` | 10 | Active |
| `getXStateContext()` | 5 | Active |
| `hasXStateValue()` | 2 | Active |
| `hasAnyXStateValue()` | 0 | **Dead code** |
| `logXStateDebug()` | 0 | **Dead code** |

#### xstateUnified.ts — Wrapper layer, could be simplified

| Export | Usages | Notes |
|--------|--------|-------|
| `XStateChecker` class | 7 | Used in admin hooks + services |
| `createXStateChecker()` | 6 | Factory for XStateChecker |
| `XStateUtils` | 2 | Redundant re-export of helpers |
| Re-exports from xstateHelpers | - | Indirection layer |

#### Consolidation plan

**Target:** Merge `xstateHelpers.ts` + `xstateUnified.ts` → single `xstateQueries.ts`
- Delete dead functions (`hasAnyXStateValue`, `logXStateDebug`)
- Inline `XStateUtils` re-export (only 2 usages)
- Keep `XStateChecker` class (7 usages justify it)
- Remove the unnecessary indirection layer

### Why Stately Studio Can't Work Today

Stately Studio supports **round-trip editing**: import machine → edit visually → export code. But this requires:

- Machine definitions to be **pure** (no inline business logic in guards/actions)
- Side effects declared as **named actions** (not inline functions)
- State names to be **stable** (not generated or interpolated)

Currently, the machines have:
- 71-150 line guard functions with logging and business logic inline
- Side effects handled outside the machine (in `handleStateTransitions`) — invisible to Stately
- No action declarations — entry/exit actions are all inline `console.log`

---

## Refactoring Phases

### Phase 0: Dead code removal and consolidation

**Goal:** Clean slate before restructuring. Remove dead code, consolidate scattered helpers.

**Changes:**

1. **Delete dead functions:**
   - `hasAnyXStateValue()` from `xstateHelpers.ts` (0 usages)
   - `logXStateDebug()` from `xstateHelpers.ts` (0 usages)

2. **Merge `xstateHelpers.ts` + `xstateUnified.ts` → `xstateQueries.ts`:**
   - Keep: `getXStateValue()`, `hasXStateValue()`, `getXStateContext()`, `XStateChecker`, `createXStateChecker()`
   - Delete: `XStateUtils` re-export (inline at 2 call sites)
   - Update all imports (10 files)

3. **Un-export internal-only functions from `xstateUtilsV5.ts`:**
   - `createXStateDataFromBookingStatus()` → remove `export`
   - `restoreXStateFromFirestore()` → remove `export`
   - `PersistedXStateData` → remove `export`

4. **Remove excessive console.log in machine guards/entry actions:**
   - 80+ logging statements add ~1,000 lines of noise
   - Keep only error-level logs

**Risk:** Low — only removing unused code and consolidating.
**Estimated reduction:** ~200 lines removed, 2 files → 1 file.

---

### Phase 1: Split `xstateUtilsV5.ts` into focused modules

**Goal:** Break the God Object into single-responsibility modules.

**Output files:**

| File | Responsibility | Approx. lines |
|------|---------------|---------------|
| `xstateEffects.ts` | Email sending, calendar updates, logging — shared utilities | ~150 |
| `xstateStateHandlers.ts` | Per-state handlers (replaces `handleStateTransitions`) | ~300 |
| `xstatePersistence.ts` | Firestore snapshot save/restore/migration | ~300 |
| `xstateTransitions.ts` | `executeXStateTransition()` orchestration | ~200 |
| `xstateTypes.ts` | State name enums, event type enums, context types | ~80 |

**Key changes:**
- Extract email sending (3 duplicates → 1 `sendTransitionEmail()`)
- Extract calendar updates (4 duplicates → 1 `updateCalendarStatus()`)
- Each state gets its own handler function: `handleDecline()`, `handleApprove()`, `handleNoShow()`, etc.
- `handleStateTransitions()` becomes a simple dispatch map:

```ts
const handlers: Record<string, StateHandler> = {
  Declined: handleDecline,
  Approved: handleApprove,
  "No Show": handleNoShow,
  // ...
};
const handler = handlers[currentState];
if (handler) await handler(context);
```

**Estimated reduction:** 2,001 → ~1,030 lines total (across 5 files)

---

### Phase 2: Factory pattern for MC service states

**Goal:** Eliminate 1,300+ lines of duplicate service state definitions.

**Before (per service, ~200 lines each × 6):**
```ts
"Staff Request": {
  initial: "Evaluate Staff Request",
  states: {
    "Evaluate Staff Request": { always: [{ guard: ..., target: ... }] },
    "Staff Requested": { on: { approveStaff: ..., declineStaff: ... } },
    "Staff Approved": { type: "final" },
    "Staff Declined": { type: "final" },
  }
}
// Repeat for Equipment, Catering, Cleaning, Security, Setup
```

**After:**
```ts
const SERVICE_TYPES = ["staff", "equipment", "catering", "cleaning", "security", "setup"] as const;

function createServiceRequestStates(services: typeof SERVICE_TYPES) {
  return Object.fromEntries(
    services.map(service => [
      `${capitalize(service)} Request`,
      createSingleServiceState(service)
    ])
  );
}
```

**Estimated reduction:** 1,939 → ~600 lines

**Stately compatibility:** The generated states are still valid `createMachine()` definitions. Stately can import the expanded output. For Stately round-trip, we can export → run through factory on import.

---

### Phase 3: Externalize side effects as named actions

**Goal:** Make side effects testable in isolation and reduce the `handleStateTransitions()` dispatcher.

**Before:**
```ts
// Side effects invisible to the machine — handled in handleStateTransitions()
"Declined": {
  entry: () => console.log("Entered Declined"),  // only logging
}
// Email + calendar + DB update happens in a separate 702-line function
```

**After:**
```ts
// Side effects declared as named actions in the machine
"Declined": {
  entry: ["logStateEntry", "sendDeclineEmail", "updateCalendarDeclined", "logBookingChange"],
}
```

```ts
// Actions provided externally when creating the actor
const actor = createActor(mcBookingMachine, {
  ...restoredSnapshot,
  implementations: {
    actions: {
      sendDeclineEmail: ({ context }) => { /* ... */ },
      updateCalendarDeclined: ({ context }) => { /* ... */ },
      logBookingChange: ({ context }) => { /* ... */ },
      logStateEntry: ({ context, self }) => { /* ... */ },
    },
  },
});
```

**Why this matters:**
- Each side effect is independently testable
- Adding a new state's side effects means adding a named action, not editing a 702-line if-else
- Machine definition clearly shows what happens on each transition

**Estimated reduction of `handleStateTransitions()`:** 702 → 0 lines (eliminated entirely)

---

### Phase 4: Type safety and constants

**Goal:** Eliminate magic strings, create single source of truth.

```ts
// xstateTypes.ts
export const BookingStates = {
  REQUESTED: "Requested",
  PRE_APPROVED: "Pre-approved",
  APPROVED: "Approved",
  DECLINED: "Declined",
  CANCELED: "Canceled",
  CHECKED_IN: "Checked In",
  CHECKED_OUT: "Checked Out",
  NO_SHOW: "No Show",
  CLOSED: "Closed",
} as const;

export const BookingEvents = {
  APPROVE: "approve",
  DECLINE: "decline",
  CANCEL: "cancel",
  REVOKE: "revoke",  // Phase 6
  // ...
} as const;

export const ServiceTypes = ["staff", "equipment", "catering", "cleaning", "security", "setup"] as const;
```

- API route event validation auto-derived from `BookingEvents`
- `statusFromXState.ts` uses `BookingStates` instead of string literals
- Service field mapping centralized

---

### Phase 5: Test coverage

**Goal:** Confidence to refactor and add features.

| Test type | What | File |
|-----------|------|------|
| Unit | Each state handler in isolation | `xstateStateHandlers.unit.test.ts` |
| Unit | Persistence save/restore/migration | `xstatePersistence.unit.test.ts` |
| Unit | Side effect utilities | `xstateEffects.unit.test.ts` |
| Integration | `executeXStateTransition()` with mocked DB | `xstateTransitions.integration.test.ts` |
| Machine | Every transition path (ITP + MC) | existing files, expanded |

---

### Phase 6: Add `revoke` event

**Goal:** Allow admins to undo approvals.

**Prerequisite:** Phases 1-4 complete.

**Machine changes (trivial after refactoring):**
```ts
"Pre-approved": {
  on: {
    approve: "Approved",
    revoke: "Requested",    // ← new
    cancel: "Canceled",
    decline: "Declined",
  },
  entry: ["logStateEntry"],
},
"Approved": {
  on: {
    revoke: "Pre-approved",  // ← new
    checkIn: "Checked In",
    cancel: "Canceled",
    noShow: "No Show",
  },
  entry: ["logStateEntry"],
},
```

**Named actions to add:**
```ts
actions: {
  sendRevokeEmail: ({ context }) => { /* notify relevant parties */ },
  clearApprovalTimestamps: ({ context }) => { /* clear firstApprovedAt or finalApprovedAt */ },
  logBookingChange: ({ context }) => { /* audit log */ },
}
```

**With AI-assisted development:** PM describes "Add a revoke event that undoes approval and sends a notification email." AI generates the machine transition + action implementation + API route + tests.

---

## Risks and Concerns

### Phase 0-2 (Low risk — code quality improvement)

These phases only restructure and deduplicate code without changing runtime behavior. Safe to ship incrementally with existing tests.

### Phase 3 (High risk — architectural change)

This is the hardest and most dangerous phase. Moving side effects from `handleStateTransitions()` into XState named actions fundamentally changes:

- **When side effects execute:** Currently controlled by explicit if-else; after, controlled by XState's entry/exit lifecycle
- **Error handling:** Currently wrapped in try-catch per effect; in XState actions, errors propagate differently
- **Ordering:** Currently sequential and explicit; XState actions run in declaration order but with less visibility

The previous attempt at this (PR #1291) was closed as UNSTABLE. Must be validated extensively on staging before merging to main.

**Mitigation:**
- Ship Phase 0-2 first and let them stabilize in production
- Phase 3 should be behind a feature flag or tenant-gated (test on ITP first, then MC)
- Write comprehensive tests (Phase 5) before or during Phase 3, not after

### Production safety

The booking workflow is used daily in production. Every phase must:
- Pass all existing unit and E2E tests
- Be validated on staging/development before merging to main
- Be deployable independently (no cross-phase dependencies at deploy time)
- Have a rollback plan (revert the PR)

---

## Execution Order and Dependencies

```
Phase 0 (Cleanup / dead code removal)
    ↓
Phase 1 (Split xstateUtilsV5.ts)
    ↓
Phase 2 (MC service factory) ──── can start in parallel ──── Phase 4 (Type safety)
    ↓
Phase 3 (Named actions)  ← depends on Phase 1
    ↓
Phase 5 (Tests)  ← should follow each phase incrementally
    ↓
Phase 6 (Revoke)  ← requires Phase 3 for clean implementation
```

## Estimated Impact

| Metric | Before | After |
|--------|--------|-------|
| Total lines | 4,635 | ~1,600 |
| Largest function | 702 lines | ~30 lines |
| Duplicate code | ~1,500 lines | ~0 |
| Magic strings | ~50+ | 0 |
| Test coverage of transitions | minimal | comprehensive |
| AI-friendly code structure | No (God Object) | Yes (focused modules) |
| Time to add new state | Hours (manual) | Minutes (AI-assisted) |
