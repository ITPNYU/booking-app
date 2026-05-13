import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PagePermission } from "@/components/src/types";
import {
  DEFAULT_SITE_BANNER_COLOR_HEX,
  SITE_BANNER_SETTINGS_DOC_ID,
} from "@/lib/utils/siteBannerHex";

const banner = (overrides: Record<string, unknown> = {}) => ({
  enabled: false,
  message: "",
  colorHex: "#7b1fa2",
  ...overrides,
});

const mocks = vi.hoisted(() => {
  const mockSet = vi.fn();
  const mockDoc = vi.fn(() => ({
    set: (...args: unknown[]) => mockSet(...args),
  }));
  const mockCollection = vi.fn(() => ({
    doc: (...args: unknown[]) => mockDoc(...args),
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
    mockCollection,
    mockDoc,
    mockSet,
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

import { PUT } from "@/app/api/tenant-site-banner/route";

const createPutRequest = (body: object) =>
  new NextRequest("http://localhost:3000/api/tenant-site-banner", {
    method: "PUT",
    headers: new Headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });

const parseJson = async (response: Response) => ({
  data: await response.json(),
  status: response.status,
});

describe("PUT /api/tenant-site-banner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockRequireSession.mockResolvedValue({
      email: "admin@nyu.edu",
      netId: "admin",
    });
    mocks.mockResolveCallerRole.mockResolvedValue(PagePermission.ADMIN);
    mocks.mockSet.mockResolvedValue(undefined);
  });

  it("returns 401 when session is missing", async () => {
    mocks.mockRequireSession.mockResolvedValue(null);

    const res = await PUT(
      createPutRequest({
        tenant: "mc",
        siteBanner: banner({ enabled: true, message: "Hi" }),
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
        siteBanner: banner(),
      }),
    );
    const { data, status } = await parseJson(res);

    expect(status).toBe(400);
    expect(data.error).toBe("Invalid tenant");
    expect(mocks.mockSet).not.toHaveBeenCalled();
  });

  it("returns 403 when caller is not admin or super-admin", async () => {
    mocks.mockResolveCallerRole.mockResolvedValue(PagePermission.BOOKING);

    const res = await PUT(
      createPutRequest({
        tenant: "mc",
        siteBanner: banner({ enabled: true, message: "x" }),
      }),
    );
    const { data, status } = await parseJson(res);

    expect(status).toBe(403);
    expect(data.error).toBe("Forbidden");
    expect(mocks.mockSet).not.toHaveBeenCalled();
  });

  it("returns 400 when siteBanner is missing", async () => {
    const res = await PUT(createPutRequest({ tenant: "mc" }));
    const { data, status } = await parseJson(res);

    expect(status).toBe(400);
    expect(data.error).toBe("siteBanner required");
  });

  it("returns 400 when siteBanner is an array", async () => {
    const res = await PUT(createPutRequest({ tenant: "mc", siteBanner: [] }));
    const { data, status } = await parseJson(res);

    expect(status).toBe(400);
    expect(data.error).toBe("siteBanner must be a plain object");
  });

  it("returns 400 when enabled is not a boolean", async () => {
    const res = await PUT(
      createPutRequest({
        tenant: "mc",
        siteBanner: banner({ enabled: "false", message: "" }),
      }),
    );
    const { data, status } = await parseJson(res);

    expect(status).toBe(400);
    expect(data.error).toBe("siteBanner.enabled must be a boolean");
  });

  it("returns 400 when message is not a string", async () => {
    const res = await PUT(
      createPutRequest({
        tenant: "mc",
        siteBanner: banner({ enabled: false, message: null }),
      }),
    );
    const { data, status } = await parseJson(res);

    expect(status).toBe(400);
    expect(data.error).toBe("siteBanner.message must be a string");
  });

  it("returns 400 when colorHex is missing", async () => {
    const res = await PUT(
      createPutRequest({
        tenant: "mc",
        siteBanner: { enabled: true, message: "x" },
      }),
    );
    const { data, status } = await parseJson(res);

    expect(status).toBe(400);
    expect(data.error).toBe("siteBanner.colorHex must be a string");
  });

  it("returns 400 when colorHex is not a string", async () => {
    const res = await PUT(
      createPutRequest({
        tenant: "mc",
        siteBanner: banner({ enabled: true, message: "x", colorHex: 123 }),
      }),
    );
    const { data, status } = await parseJson(res);

    expect(status).toBe(400);
    expect(data.error).toBe("siteBanner.colorHex must be a string");
  });

  it("returns 400 for invalid hex color", async () => {
    const res = await PUT(
      createPutRequest({
        tenant: "mc",
        siteBanner: banner({
          enabled: true,
          message: "x",
          colorHex: "#gg0000",
        }),
      }),
    );
    const { data, status } = await parseJson(res);

    expect(status).toBe(400);
    expect(data.error).toBe("siteBanner.colorHex must be #RGB or #RRGGBB hex");
  });

  it("uses default hex when colorHex is whitespace-only", async () => {
    const res = await PUT(
      createPutRequest({
        tenant: "mc",
        siteBanner: banner({
          enabled: true,
          message: "Hi",
          colorHex: "   ",
        }),
      }),
    );
    const { data, status } = await parseJson(res);

    expect(status).toBe(200);
    expect(mocks.mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        siteBanner: expect.objectContaining({
          colorHex: DEFAULT_SITE_BANNER_COLOR_HEX,
        }),
      }),
      { merge: true },
    );
    expect(data).toEqual({ ok: true });
  });

  it("returns 200 and writes Firestore for valid admin payload", async () => {
    const res = await PUT(
      createPutRequest({
        tenant: "mc",
        siteBanner: banner({
          enabled: true,
          message: "Hello",
          colorHex: "#0066cc",
        }),
      }),
    );
    const { data, status } = await parseJson(res);

    expect(status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mocks.mockCollection).toHaveBeenCalledWith("mc-settings");
    expect(mocks.mockDoc).toHaveBeenCalledWith(SITE_BANNER_SETTINGS_DOC_ID);
    expect(mocks.mockSet).toHaveBeenCalledTimes(1);
    expect(mocks.mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        siteBanner: {
          enabled: true,
          message: "Hello",
          colorHex: "#0066cc",
        },
      }),
      { merge: true },
    );
  });

  it("returns 500 with JSON when Firestore set throws", async () => {
    mocks.mockSet.mockRejectedValueOnce(new Error("network"));

    const res = await PUT(
      createPutRequest({
        tenant: "mc",
        siteBanner: banner(),
      }),
    );
    const { data, status } = await parseJson(res);

    expect(status).toBe(500);
    expect(data.error).toBe("Failed to save site banner");
  });
});
