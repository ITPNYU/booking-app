import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ALLOWED_TENANTS } from "@/components/src/constants/tenants";
import { PagePermission } from "@/components/src/types";
import {
  DEFAULT_MAINTENANCE_MODE_MESSAGE,
  MAINTENANCE_MODE_SETTINGS_DOC_ID,
} from "@/lib/utils/maintenanceMode";

const maintenanceMode = (overrides: Record<string, unknown> = {}) => ({
  enabled: false,
  message: "Requests are paused.",
  ...overrides,
});

const mocks = vi.hoisted(() => {
  const mockAdminGet = vi.fn();
  const mockLimit = vi.fn(() => ({ get: mockAdminGet }));
  const mockWhere = vi.fn(() => ({ where: mockWhere, limit: mockLimit }));
  const mockSet = vi.fn();
  const mockDoc = vi.fn(() => ({
    set: (...args: unknown[]) => mockSet(...args),
  }));
  const mockCollection = vi.fn(() => ({
    doc: (...args: unknown[]) => mockDoc(...args),
    where: (...args: unknown[]) => mockWhere(...args),
  }));
  const mockFirestoreFn = Object.assign(
    () => ({
      collection: (...args: unknown[]) => mockCollection(...args),
    }),
    {
      FieldValue: {
        serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })),
      },
    },
  );
  return {
    mockRequireSession: vi.fn(),
    mockResolveCallerRole: vi.fn(),
    mockAdminGet,
    mockCollection,
    mockDoc,
    mockLimit,
    mockSet,
    mockWhere,
    mockFirestoreFn,
  };
});

vi.mock("@/lib/api/requireSession", () => ({
  requireSession: () => mocks.mockRequireSession(),
}));

vi.mock("@/lib/api/authz", () => ({
  resolveCallerRole: (...args: unknown[]) =>
    mocks.mockResolveCallerRole(...args),
}));

vi.mock("@/lib/firebase/server/firebaseAdmin", () => ({
  default: {
    firestore: mocks.mockFirestoreFn,
  },
}));

import { PUT } from "@/app/api/tenant-maintenance-mode/route";

const createPutRequest = (body: object) =>
  new NextRequest("http://localhost:3000/api/tenant-maintenance-mode", {
    method: "PUT",
    headers: new Headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });

const parseJson = async (response: Response) => ({
  data: await response.json(),
  status: response.status,
});

describe("PUT /api/tenant-maintenance-mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockRequireSession.mockResolvedValue({
      email: "admin@nyu.edu",
      netId: "admin",
    });
    mocks.mockResolveCallerRole.mockResolvedValue(PagePermission.SUPER_ADMIN);
    mocks.mockAdminGet.mockResolvedValue({ empty: false });
    mocks.mockSet.mockResolvedValue(undefined);
  });

  it("returns 401 when session is missing", async () => {
    mocks.mockRequireSession.mockResolvedValue(null);

    const res = await PUT(
      createPutRequest({
        tenant: "mc",
        maintenanceMode: maintenanceMode({ enabled: true }),
      }),
    );
    const { data, status } = await parseJson(res);

    expect(status).toBe(401);
    expect(data.error).toBe("Unauthorized");
    expect(mocks.mockSet).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid tenant", async () => {
    const res = await PUT(
      createPutRequest({
        tenant: "not-a-real-tenant",
        maintenanceMode: maintenanceMode(),
      }),
    );
    const { data, status } = await parseJson(res);

    expect(status).toBe(400);
    expect(data.error).toBe("Invalid tenant");
    expect(mocks.mockSet).not.toHaveBeenCalled();
  });

  it("returns 403 when caller is not a super admin", async () => {
    mocks.mockResolveCallerRole.mockResolvedValue(PagePermission.BOOKING);

    const res = await PUT(
      createPutRequest({
        tenant: "mc",
        maintenanceMode: maintenanceMode({ enabled: true }),
      }),
    );
    const { data, status } = await parseJson(res);

    expect(status).toBe(403);
    expect(data.error).toBe("Forbidden");
    expect(mocks.mockSet).not.toHaveBeenCalled();
  });

  it("returns 403 when caller is only a tenant admin", async () => {
    mocks.mockResolveCallerRole.mockResolvedValue(PagePermission.ADMIN);

    const res = await PUT(
      createPutRequest({
        tenant: "mc",
        maintenanceMode: maintenanceMode({ enabled: true }),
      }),
    );
    const { data, status } = await parseJson(res);

    expect(status).toBe(403);
    expect(data.error).toBe("Forbidden");
    expect(mocks.mockSet).not.toHaveBeenCalled();
  });

  it("allows a super-admin without a tenant database admin doc", async () => {
    mocks.mockResolveCallerRole.mockResolvedValue(PagePermission.SUPER_ADMIN);

    const res = await PUT(
      createPutRequest({
        tenant: "mc",
        maintenanceMode: maintenanceMode({ enabled: false }),
      }),
    );
    const { data, status } = await parseJson(res);

    expect(status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mocks.mockSet).toHaveBeenCalled();
    expect(mocks.mockWhere).not.toHaveBeenCalledWith(
      "isAdmin",
      "==",
      true,
    );
  });

  it("returns 400 when maintenanceMode is missing", async () => {
    const res = await PUT(createPutRequest({ tenant: "mc" }));
    const { data, status } = await parseJson(res);

    expect(status).toBe(400);
    expect(data.error).toBe("maintenanceMode required");
  });

  it("returns 400 when enabled is not a boolean", async () => {
    const res = await PUT(
      createPutRequest({
        tenant: "mc",
        maintenanceMode: maintenanceMode({ enabled: "false" }),
      }),
    );
    const { data, status } = await parseJson(res);

    expect(status).toBe(400);
    expect(data.error).toBe("maintenanceMode.enabled must be a boolean");
  });

  it("returns 400 when message is not a string", async () => {
    const res = await PUT(
      createPutRequest({
        tenant: "mc",
        maintenanceMode: maintenanceMode({ message: null }),
      }),
    );
    const { data, status } = await parseJson(res);

    expect(status).toBe(400);
    expect(data.error).toBe("maintenanceMode.message must be a string");
  });

  it("uses the default message when saving a blank message", async () => {
    const res = await PUT(
      createPutRequest({
        tenant: "mc",
        maintenanceMode: maintenanceMode({ enabled: true, message: "   " }),
      }),
    );
    const { data, status } = await parseJson(res);

    expect(status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mocks.mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        maintenanceMode: {
          enabled: true,
          message: DEFAULT_MAINTENANCE_MODE_MESSAGE,
        },
      }),
      { merge: true },
    );
  });

  it("returns 200 and writes Firestore for all tenants for valid super-admin payload", async () => {
    const res = await PUT(
      createPutRequest({
        tenant: "mc",
        maintenanceMode: maintenanceMode({
          enabled: true,
          message: "Requests are paused for maintenance.",
        }),
      }),
    );
    const { data, status } = await parseJson(res);

    expect(status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mocks.mockResolveCallerRole).toHaveBeenCalledWith(
      { email: "admin@nyu.edu", netId: "admin" },
      "mc",
    );
    expect(mocks.mockCollection).not.toHaveBeenCalledWith("mc-usersRights");
    ALLOWED_TENANTS.forEach((targetTenant) => {
      expect(mocks.mockCollection).toHaveBeenCalledWith(
        `${targetTenant}-settings`,
      );
    });
    expect(mocks.mockDoc).toHaveBeenCalledTimes(ALLOWED_TENANTS.length);
    expect(mocks.mockDoc).toHaveBeenCalledWith(MAINTENANCE_MODE_SETTINGS_DOC_ID);
    expect(mocks.mockSet).toHaveBeenCalledTimes(ALLOWED_TENANTS.length);
    ALLOWED_TENANTS.forEach(() => {
      expect(mocks.mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          maintenanceMode: {
            enabled: true,
            message: "Requests are paused for maintenance.",
          },
        }),
        { merge: true },
      );
    });
  });

  it("returns 500 with JSON when Firestore set throws", async () => {
    mocks.mockSet.mockRejectedValueOnce(new Error("network"));

    const res = await PUT(
      createPutRequest({
        tenant: "mc",
        maintenanceMode: maintenanceMode(),
      }),
    );
    const { data, status } = await parseJson(res);

    expect(status).toBe(500);
    expect(data.error).toBe("Failed to save maintenance mode");
  });
});
