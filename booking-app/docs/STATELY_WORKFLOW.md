# Editing the Media Commons booking machine in Stately Studio

`lib/stateMachines/mcBookingMachine.ts` is written so that it round-trips
through [Stately Studio](https://stately.ai/editor): import the file, edit the
diagram, export TypeScript, and merge the result back. This document describes
how the file is split, what a PM can change in Stately, and how an engineer
merges an export.

## How the machine is split

| File | Owner | Contents |
| --- | --- | --- |
| `lib/stateMachines/mcBookingMachine.ts` | Stately (via PM) | `setup({...}).createMachine({...})`. The `createMachine` argument is a plain object literal: states, transitions, event names, and guard/action **names**. |
| `lib/stateMachines/mcBookingMachineImpl.ts` | Engineering | `mcBookingActions`, `mcBookingGuards`, `buildMcInitialContext`. Every function body lives here. |
| `lib/stateMachines/mcBookingMachineTypes.ts` | Engineering | Context and event types. |

The machine file references implementations by name only
(`guard: { type: "servicesApproved" }`, `actions: "approveStaffService"`,
`{ type: "logStateEntry", params: { label: "..." } }`). `setup()` types the
config against the implementation objects, so a name used in the machine
without an implementation in the impl file is a `tsc` error.

Two unit tests enforce the split:

- `tests/unit/mc-booking-machine-stately-literal.unit.test.ts` parses the
  machine file and fails if the `createMachine` argument contains functions,
  calls, spreads, template strings, computed keys, or inline implementations.
- `tests/unit/mc-booking-machine-service-parity.unit.test.ts` checks that the
  six per-service regions under `Services Request` and `Service Closeout` all
  have the same shape (see `tests/unit/helpers/mcServiceStateFactory.ts` for
  the reference).

## Round trip

1. **Import.** In Stately Studio create a new project and import
   `lib/stateMachines/mcBookingMachine.ts` from the current `main`.
2. **Edit** the diagram.
3. **Export** as TypeScript (XState v5). Stately replaces every action and
   guard implementation with a stub such as `function () {}`; that is expected.
4. **Merge.** Open the exported file next to `mcBookingMachine.ts` and copy
   **only the argument of `createMachine(...)`** over the existing one. Leave
   the imports, the `setup({...})` block, and the header comment untouched.
   Stately may also reorder keys or add an `id` per state; either is fine.
5. **Verify.**
   ```sh
   npx tsc --noEmit
   npx vitest --run tests/unit/mc-booking-machine
   ```
   A `tsc` error on the machine file means the diagram references a guard or
   action that has no implementation yet.
6. Open a PR as usual.

## What is safe to change in Stately

- Add or remove a transition between existing states.
- Add a new state, as long as every guard/action it references already exists
  or is implemented in the same PR.
- Add, remove, or reorder `entry` actions that already exist
  (`sendHTMLEmail`, `updateCalendarEvent`, `logStateEntry`, ...).
- Change the `label` of a `logStateEntry` action.
- Change which named guard a transition uses.

## What needs an engineer

- **Renaming an existing state or event.** State names are stored verbatim in
  Firestore (`xstateData.snapshot.value`) and compared as strings in
  `useBookingActions.tsx`, `statusFromXState.ts`, and
  `serviceApproverNotifications.ts`. A rename is a data migration.
- **A new guard or action name.** The diagram can reference it, but `tsc` will
  fail until the implementation is added to `mcBookingMachineImpl.ts`.
- **A new context field.** Types live in `mcBookingMachineTypes.ts`.
- **A new service.** Adding a `"<Name> Request"` / `"<Name> Closeout"` region
  to the machine is only the first step. The service key also has to be added
  to `getMediaCommonsServices()`, the event allow-lists in
  `app/api/xstate-transition`, `app/api/bookings`, and `app/api/services`, the
  `<name>ServiceApproved` Firestore field, the approver right and notification
  config, and the admin UI. Treat it as a feature ticket.
- **Anything with a function body**, including `always` guards with inline
  logic. Put the logic in the impl file and reference it by name.

## Why the machine is written as a literal

Stately parses the source statically; it does not execute it. A state built
with `Object.fromEntries(SERVICE_CONFIGS.map(...))`, a spread, or a helper
function call is invisible to the importer, which is why the six service
regions used to show up empty. The regions are now written out in full, and
the parity test replaces the factory as the guard against the copies drifting.
