import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const superSnap = vi.fn();
const usersRightsSnap = vi.fn();
const approverSnap = vi.fn();
const assignmentSnap = vi.fn();

function snapshot(docs: Array<Record<string, unknown>>) {
  return {
    empty: docs.length === 0,
    docs: docs.map((data) => ({ data: () => data })),
  };
}

vi.mock("@/lib/firebase/server/firebaseAdmin", () => {
  const collection = vi.fn((name: string) => {
    const where = (_field: string, _op: string, _value: unknown) => ({
      limit: () => ({
        get: async () => {
          if (name === "usersSuperAdmin") return snapshot(superSnap());
          if (name.endsWith("usersRights")) return snapshot(usersRightsSnap());
          if (name.endsWith("usersApprovers")) return snapshot(approverSnap());
          if (name.endsWith("usersApproversResources"))
            return snapshot(assignmentSnap());
          return snapshot([]);
        },
      }),
    });
    return { where };
  });
  return {
    default: {
      firestore: () => ({ collection }),
    },
  };
});

import {
  authorizeRead,
  authorizeWrite,
  resolveCallerRole,
} from "@/lib/api/authz";
import { PagePermission } from "@/components/src/types";

const session = { email: "rh3555@nyu.edu", netId: "rh3555" };

beforeEach(() => {
  superSnap.mockReturnValue([]);
  usersRightsSnap.mockReturnValue([]);
  approverSnap.mockReturnValue([]);
  assignmentSnap.mockReturnValue([]);
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("authorizeWrite", () => {
  it("blocks non-admin write to usersRights", async () => {
    const decision = await authorizeWrite(session, "mc", "usersRights");
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.status).toBe(403);
    }
  });

  it("allows admin write to usersRights", async () => {
    usersRightsSnap.mockReturnValue([{ isAdmin: true }]);
    const decision = await authorizeWrite(session, "mc", "usersRights");
    expect(decision.ok).toBe(true);
  });

  it("blocks generic writes to usersApproversResources, even for admins", async () => {
    // Writes go through /api/approversResources, which keeps
    // serviceApproverEmails in step with serviceApprovers.
    usersRightsSnap.mockReturnValue([{ isAdmin: true }]);
    const decision = await authorizeWrite(
      session,
      "mc",
      "usersApproversResources",
    );
    expect(decision.ok).toBe(false);
  });

  it("blocks admin from writing usersSuperAdmin (super-only)", async () => {
    usersRightsSnap.mockReturnValue([{ isAdmin: true }]);
    const decision = await authorizeWrite(session, "mc", "usersSuperAdmin");
    expect(decision.ok).toBe(false);
  });

  it("allows super_admin to write usersSuperAdmin", async () => {
    superSnap.mockReturnValue([{ email: session.email }]);
    const decision = await authorizeWrite(session, "mc", "usersSuperAdmin");
    expect(decision.ok).toBe(true);
  });

  it("blocks tenant admins from writing maintenance mode through generic settings mutation", async () => {
    usersRightsSnap.mockReturnValue([{ isAdmin: true }]);
    const decision = await authorizeWrite(
      session,
      "mc",
      "settings",
      "maintenanceMode",
    );

    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.status).toBe(403);
    }
  });

  it("allows super admins to write maintenance mode through generic settings mutation", async () => {
    superSnap.mockReturnValue([{ email: session.email }]);
    const decision = await authorizeWrite(
      session,
      "mc",
      "settings",
      "maintenanceMode",
    );

    expect(decision.ok).toBe(true);
  });

  it("keeps non-maintenance settings writes available to tenant admins", async () => {
    usersRightsSnap.mockReturnValue([{ isAdmin: true }]);
    const decision = await authorizeWrite(
      session,
      "mc",
      "settings",
      "siteBanner",
    );

    expect(decision.ok).toBe(true);
  });

  it("allows PA write to bookings (e.g. equipment checkout toggle)", async () => {
    usersRightsSnap.mockReturnValue([{ isWorker: true }]);
    const decision = await authorizeWrite(session, "mc", "bookings");
    expect(decision.ok).toBe(true);
  });

  it("blocks regular booking-role user write to bookings", async () => {
    const decision = await authorizeWrite(session, "mc", "bookings");
    expect(decision.ok).toBe(false);
  });

  it("denies writes to unknown collection by default", async () => {
    superSnap.mockReturnValue([{ email: session.email }]);
    const decision = await authorizeWrite(session, "mc", "totally-fake");
    expect(decision.ok).toBe(false);
  });
});

describe("authorizeRead", () => {
  it("allows any NYU user to read tenantSchema", async () => {
    const decision = await authorizeRead(session, "mc", "tenantSchema");
    expect(decision.ok).toBe(true);
  });

  it("allows any NYU user to read bookings (legacy compat)", async () => {
    const decision = await authorizeRead(session, "mc", "bookings");
    expect(decision.ok).toBe(true);
  });

  it("blocks non-admin read of usersApproversResources", async () => {
    const decision = await authorizeRead(
      session,
      "mc",
      "usersApproversResources",
    );
    expect(decision.ok).toBe(false);
  });

  it("allows admin read of usersApproversResources", async () => {
    usersRightsSnap.mockReturnValue([{ isAdmin: true }]);
    const decision = await authorizeRead(
      session,
      "mc",
      "usersApproversResources",
    );
    expect(decision.ok).toBe(true);
  });

  it("blocks non-admin read of preBanLogs", async () => {
    const decision = await authorizeRead(session, "mc", "preBanLogs");
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.status).toBe(403);
    }
  });

  it("allows admin read of preBanLogs", async () => {
    usersRightsSnap.mockReturnValue([{ isAdmin: true }]);
    const decision = await authorizeRead(session, "mc", "preBanLogs");
    expect(decision.ok).toBe(true);
  });

  it("denies reads to unknown collection by default", async () => {
    const decision = await authorizeRead(session, "mc", "totally-fake");
    expect(decision.ok).toBe(false);
  });
});

describe("resolveCallerRole for service approvers", () => {
  const optIn = { includeServiceApprovers: true };

  it.each([
    [
      "an assigned approver",
      () => assignmentSnap.mockReturnValue([{ resourceId: "202" }]),
    ],
    [
      "a usersRights flag holder",
      () => usersRightsSnap.mockReturnValue([{ isFurnishings: true }]),
    ],
  ])(
    "counts %s as SERVICES only when the caller opts in",
    async (_label, arrange) => {
      arrange();
      await expect(resolveCallerRole(session, "mc", optIn)).resolves.toBe(
        PagePermission.SERVICES,
      );
      await expect(resolveCallerRole(session, "mc")).resolves.toBe(
        PagePermission.BOOKING,
      );
    },
  );

  it("doesn't look up assignments unless the caller opts in", async () => {
    await resolveCallerRole(session, "mc");
    await authorizeRead(session, "mc", "usersApproversResources");
    await authorizeWrite(session, "mc", "bookings");
    expect(assignmentSnap).not.toHaveBeenCalled();
  });

  it("doesn't let a service approver make paOrAbove writes", async () => {
    assignmentSnap.mockReturnValue([{ resourceId: "202" }]);
    usersRightsSnap.mockReturnValue([{ isCatering: true }]);
    const decision = await authorizeWrite(session, "mc", "bookings");
    expect(decision.ok).toBe(false);
  });

  it("keeps a PA a PA, so nobody loses the role they have", async () => {
    usersRightsSnap.mockReturnValue([{ isWorker: true, isSetup: true }]);
    assignmentSnap.mockReturnValue([{ resourceId: "202" }]);
    await expect(resolveCallerRole(session, "mc", optIn)).resolves.toBe(
      PagePermission.PA,
    );
  });

  it("keeps a liaison a liaison", async () => {
    approverSnap.mockReturnValue([{ level: 1 }]);
    assignmentSnap.mockReturnValue([{ resourceId: "202" }]);
    await expect(resolveCallerRole(session, "mc", optIn)).resolves.toBe(
      PagePermission.LIAISON,
    );
  });

  it("leaves everyone else booking", async () => {
    await expect(resolveCallerRole(session, "mc", optIn)).resolves.toBe(
      PagePermission.BOOKING,
    );
  });
});
