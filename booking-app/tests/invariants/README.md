# Booking state invariant tests

A booking's state is stored in several places: the XState snapshot, the
lifecycle timestamps (`declinedAt`, `canceledAt`, ...), the `[STATUS]` prefix
of the Google Calendar event, and what the bookings table displays. These
tests check that no staff action can make those copies disagree.

They run with the unit tests (`npm run test:unit`) and take about two seconds.

## What runs

`booking-state.invariant.test.ts` takes every state a booking can be in,
crossed with every action staff can take (approve, decline, cancel, check in,
check out, no show). For each pair it:

1. creates a booking and brings it to the starting state with real actions,
2. records the copies of its state,
3. performs the action through the same client function the button calls,
4. records the copies again and checks the invariants.

Nothing in the application is stubbed between the client function and the
edges of the process. The real API route handlers, server functions and state
machines run. Only the outside world is replaced (`harness/`):

| Boundary                                    | Replacement                                          |
| ------------------------------------------- | ---------------------------------------------------- |
| Firestore (`firebase-admin`)                | `fakeFirestore.ts`, in memory                        |
| Google Calendar, Gmail (`lib/googleClient`) | `fakeGoogle.ts`, in memory                           |
| `fetch` to the app's own `/api/*`           | `inProcessFetch.ts` calls the route handler directly |
| `/api/sendEmail`                            | recorded, not rendered                               |
| Session, approver check                     | a fixed staff user who may approve and decline       |

A `fetch` to any other host throws, so a test cannot reach the network.

## Invariants

- An action that leaves the machine where it was changes nothing else: no
  timestamp, no calendar change, no email.
- The calendar event exists while the booking still holds its room.
- The calendar prefix equals the status the table shows.

## known-violations.json

The code breaks these invariants today in the pairs listed in
`known-violations.json`. The test compares each pair against that list, in
both directions:

- A pair breaks an invariant that is not listed: a regression. Fix the code.
- A listed violation no longer happens: the bug is fixed. Delete the entry in
  the same pull request.

Do not add entries to make a failing test pass. The list should only shrink.
To regenerate it after an intended change:

```
UPDATE_KNOWN_VIOLATIONS=1 npx vitest run tests/invariants
```

Review the diff of the file before committing it.

## Limits

- The actions are called directly, so pairs the UI does not offer a button
  for are included. The endpoints behind them are still reachable.
- Media Commons service approval and closeout are not covered yet.
- The fakes implement only the calls the booking code makes today.
  `fakeFirestore` runs a transaction body once and does not model contention,
  so races between two requests are out of scope.

## Adding a scenario

Add an entry to `SCENARIOS` with the room to book and, for each starting
state, the actions that lead to it. Rooms come from
`lib/utils/testTenantSchema.ts`.
