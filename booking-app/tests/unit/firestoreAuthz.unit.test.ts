import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const superSnap = vi.fn();
const usersRightsSnap = vi.fn();
const approverSnap = vi.fn();

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

import { authorizeRead, authorizeWrite } from "@/lib/api/authz";

const session = { email: "rh3555@nyu.edu", netId: "rh3555" };

beforeEach(() => {
  superSnap.mockReturnValue([]);
  usersRightsSnap.mockReturnValue([]);
  approverSnap.mockReturnValue([]);
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
