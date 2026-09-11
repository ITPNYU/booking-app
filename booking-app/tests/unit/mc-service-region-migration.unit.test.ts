import { fillMissingMcServiceRegions } from "@/lib/stateMachines/mcServiceRegionMigration";
import { mcBookingMachine } from "@/lib/stateMachines/mcBookingMachine";
import { createActor } from "xstate";
import { describe, expect, it } from "vitest";
import { MC_SERVICE_CONFIGS } from "./helpers/mcServiceStateFactory";

/** Snapshot value persisted before the Furnishings region existed. */
const LEGACY_SERVICES_REQUEST = {
  "Services Request": {
    "Staff Request": "Staff Approved",
    "Catering Request": "Catering Approved",
    "Setup Request": "Setup Requested",
    "Cleaning Request": "Cleaning Approved",
    "Security Request": "Security Approved",
    "Equipment Request": "Equipment Approved",
  },
};

const LEGACY_SERVICE_CLOSEOUT = {
  "Service Closeout": {
    "Staff Closeout": "Staff Closedout",
    "Catering Closeout": "Catering Closedout",
    "Setup Closeout": "Setup Closeout Pending",
    "Cleaning Closeout": "Cleaning Closedout",
    "Security Closeout": "Security Closedout",
    "Equipment Closeout": "Equipment Closedout",
  },
};

const furnishings = MC_SERVICE_CONFIGS.find(
  (c) => c.contextKey === "furnishings",
)!;

function persistedSnapshotWith(
  value: unknown,
  context: Record<string, unknown>,
) {
  const actor = createActor(mcBookingMachine, {
    input: { tenant: "mc" } as any,
  });
  actor.start();
  const persisted: any = actor.getPersistedSnapshot();
  actor.stop();
  return { ...persisted, value, context: { ...persisted.context, ...context } };
}

describe("fillMissingMcServiceRegions", () => {
  it("leaves string and non-parallel values untouched", () => {
    expect(fillMissingMcServiceRegions("Approved", {}, {})).toBe("Approved");
    expect(fillMissingMcServiceRegions(undefined, {}, {})).toBeUndefined();
    const other = { "Pre-approved": "approve" };
    expect(fillMissingMcServiceRegions(other, {}, {})).toBe(other);
  });

  it("returns the same object when every region is present", () => {
    const value = {
      "Services Request": {
        ...LEGACY_SERVICES_REQUEST["Services Request"],
        "Furnishings Request": "Furnishings Requested",
      },
    };
    expect(fillMissingMcServiceRegions(value, { furnishings: true }, {})).toBe(
      value,
    );
  });

  it("adds a pending Furnishings Request when furnishings are requested", () => {
    const filled = fillMissingMcServiceRegions(
      LEGACY_SERVICES_REQUEST,
      { setup: true, furnishings: true },
      {},
    ) as any;
    expect(filled["Services Request"]["Furnishings Request"]).toBe(
      "Furnishings Requested",
    );
    expect(filled["Services Request"]["Setup Request"]).toBe("Setup Requested");
    expect(LEGACY_SERVICES_REQUEST["Services Request"]).not.toHaveProperty(
      "Furnishings Request",
    );
  });

  it("adds an approved Furnishings Request when furnishings are not requested", () => {
    const filled = fillMissingMcServiceRegions(
      LEGACY_SERVICES_REQUEST,
      { setup: true },
      {},
    ) as any;
    expect(filled["Services Request"]["Furnishings Request"]).toBe(
      "Furnishings Approved",
    );
  });

  it("adds a pending Furnishings Closeout only when furnishings were approved", () => {
    const pending = fillMissingMcServiceRegions(
      LEGACY_SERVICE_CLOSEOUT,
      { furnishings: true },
      { furnishings: true },
    ) as any;
    expect(pending["Service Closeout"]["Furnishings Closeout"]).toBe(
      "Furnishings Closeout Pending",
    );

    const done = fillMissingMcServiceRegions(
      LEGACY_SERVICE_CLOSEOUT,
      { furnishings: true },
      { furnishings: false },
    ) as any;
    expect(done["Service Closeout"]["Furnishings Closeout"]).toBe(
      "Furnishings Closedout",
    );
  });
});

describe("restoring a pre-furnishings snapshot into the MC machine", () => {
  it("cannot approve furnishings from the raw legacy snapshot", () => {
    const actor = createActor(mcBookingMachine, {
      snapshot: persistedSnapshotWith(LEGACY_SERVICES_REQUEST, {
        servicesRequested: { setup: true, furnishings: true },
        servicesApproved: {},
      }),
    });
    actor.start();
    expect(
      actor.getSnapshot().can({ type: furnishings.approveEvent } as any),
    ).toBe(false);
    actor.stop();
  });

  it("can approve furnishings once the region is filled in", () => {
    const servicesRequested = { setup: true, furnishings: true };
    const actor = createActor(mcBookingMachine, {
      snapshot: persistedSnapshotWith(
        fillMissingMcServiceRegions(
          LEGACY_SERVICES_REQUEST,
          servicesRequested,
          {},
        ),
        { servicesRequested, servicesApproved: {} },
      ),
    });
    actor.start();
    expect(
      actor.getSnapshot().can({ type: furnishings.approveEvent } as any),
    ).toBe(true);
    actor.send({ type: furnishings.approveEvent } as any);
    actor.send({ type: "approveSetup" });
    expect(actor.getSnapshot().value).toBe("Approved");
    expect(actor.getSnapshot().context.servicesApproved).toMatchObject({
      furnishings: true,
      setup: true,
    });
    actor.stop();
  });

  it("closes out a legacy closeout snapshot without a furnishings decision", () => {
    const servicesApproved = { setup: true };
    const actor = createActor(mcBookingMachine, {
      snapshot: persistedSnapshotWith(
        fillMissingMcServiceRegions(
          LEGACY_SERVICE_CLOSEOUT,
          { setup: true },
          servicesApproved,
        ),
        { servicesRequested: { setup: true }, servicesApproved },
      ),
    });
    actor.start();
    expect(
      actor.getSnapshot().can({ type: furnishings.closeoutEvent } as any),
    ).toBe(false);
    actor.send({ type: "closeoutSetup" });
    expect(actor.getSnapshot().value).toBe("Closed");
    actor.stop();
  });
});
