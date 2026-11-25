import "./harness/mocks";
import { inProcessFetch } from "./harness/inProcessFetch";
import { LIVE_STATES, observe, type Observation } from "./harness/observe";
import { attempt, OPERATIONS, type Operation } from "./harness/operations";
import { seedRequestedBooking, type SeedOptions } from "./harness/seed";
import { world } from "./harness/world";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Every state a booking can be in, crossed with every action staff can take
 * on it, run through the real client functions, API routes and state
 * machines. After each action the copies of the booking's state (machine
 * snapshot, lifecycle timestamps, calendar title, what the table shows) must
 * still agree.
 *
 * Cells that break an invariant today are listed in known-violations.json.
 * The test fails when a cell breaks an invariant that is not listed (a
 * regression) and also when a listed violation no longer happens (a fix:
 * delete the entry in the same change). See README.md.
 */
const BASELINE_FILE = path.resolve(__dirname, "known-violations.json");
const UPDATE_BASELINE = process.env.UPDATE_KNOWN_VIOLATIONS === "1";
const KNOWN: Record<string, string[]> = existsSync(BASELINE_FILE)
  ? JSON.parse(readFileSync(BASELINE_FILE, "utf8"))
  : {};
const observed: Record<string, string[]> = {};

const SCENARIOS: Record<
  string,
  { seed: SeedOptions; paths: Record<string, Operation[]> }
> = {
  "mc, no services": {
    seed: { tenant: "mc", roomId: "203", calendarId: "mock-calendar-203" },
    paths: {
      Requested: [],
      "Pre-approved": ["approve"],
      Approved: ["approve", "approve"],
      Declined: ["decline"],
      "Checked In": ["approve", "approve", "checkIn"],
      "Closed (checked out)": ["approve", "approve", "checkIn", "checkOut"],
      "Closed (canceled)": ["cancel"],
      "Closed (no show)": ["approve", "approve", "noShow"],
    },
  },
  itp: {
    seed: { tenant: "itp", roomId: "408", calendarId: "mock-calendar-408" },
    paths: {
      Requested: [],
      Approved: ["approve"],
      Declined: ["decline"],
      "Checked In": ["approve", "checkIn"],
      "Closed (checked out)": ["approve", "checkIn", "checkOut"],
      "Closed (canceled)": ["cancel"],
      "Closed (no show)": ["approve", "noShow"],
    },
  },
};

/** What must hold after any operation, whatever state it started from. */
function violations(before: Observation, after: Observation): string[] {
  const found: string[] = [];
  const moved =
    JSON.stringify(before.machine) !== JSON.stringify(after.machine);

  if (!moved) {
    const added = after.stamps.filter((s) => !before.stamps.includes(s));
    const removed = before.stamps.filter((s) => !after.stamps.includes(s));
    if (added.length || removed.length)
      found.push(`refused, but stamps changed: +[${added}] -[${removed}]`);
    if (before.calendarPrefix !== after.calendarPrefix)
      found.push(
        `refused, but calendar changed: ${before.calendarPrefix} -> ${after.calendarPrefix}`,
      );
    if (before.emails !== after.emails)
      found.push("refused, but an email was sent");
  }
  if (after.calendarPrefix === null && LIVE_STATES.includes(after.top))
    found.push(`calendar event gone while the machine is ${after.top}`);
  if (after.calendarPrefix !== null && after.calendarPrefix !== after.display)
    found.push(
      `calendar says ${after.calendarPrefix}, table says ${after.display}`,
    );
  return found;
}

const cells = Object.entries(SCENARIOS).flatMap(([scenario, { seed, paths }]) =>
  Object.entries(paths).flatMap(([state, path]) =>
    (Object.keys(OPERATIONS) as Operation[]).map((op) => ({
      name: `${scenario} | ${state} | ${op}`,
      seed,
      path,
      op,
    })),
  ),
);

describe("booking state invariants", () => {
  beforeEach(() => {
    world.reset();
    vi.stubGlobal("fetch", inProcessFetch);
  });

  afterAll(() => {
    if (UPDATE_BASELINE)
      writeFileSync(BASELINE_FILE, `${JSON.stringify(observed, null, 2)}\n`);
  });

  it.each(cells)("$name", async ({ name, seed, path: steps, op }) => {
    const booking = await seedRequestedBooking(seed);
    for (const step of steps) {
      const result = await attempt(step, booking);
      if (!result.ok)
        throw new Error(`setup step ${step} failed: ${result.error}`);
    }
    const before = await observe(booking);
    await attempt(op, booking);
    const after = await observe(booking);
    const found = violations(before, after);
    if (found.length > 0) observed[name] = found;

    if (!UPDATE_BASELINE) expect(found).toEqual(KNOWN[name] ?? []);
  });
});
