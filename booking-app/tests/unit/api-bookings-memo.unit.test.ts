import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PagePermission } from "@/components/src/types";
import { TableNames } from "@/components/src/policy";

const mocks = vi.hoisted(() => ({
  mockRequireSession: vi.fn(),
  mockResolveCallerRole: vi.fn(),
  mockUpdateByCalendarEventId: vi.fn(),
}));

vi.mock("@/lib/api/requireSession", () => ({
  requireSession: () => mocks.mockRequireSession(),
}));

vi.mock("@/lib/api/authz", () => ({
  resolveCallerRole: (...args: unknown[]) =>
    mocks.mockResolveCallerRole(...args),
}));

vi.mock("@/components/src/server/admin", () => ({
  serverUpdateDataByCalendarEventId: (...args: unknown[]) =>
    mocks.mockUpdateByCalendarEventId(...args),
}));

import { BOOKING_MEMO_MAX_LEN, PUT } from "@/app/api/bookings/memo/route";

const createRequest = (body: unknown, tenant?: string) =>
  new NextRequest("http://localhost:3000/api/bookings/memo", {
    method: "PUT",
    headers: new Headers({
      "Content-Type": "application/json",
      ...(tenant ? { "x-tenant": tenant } : {}),
    }),
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("PUT /api/bookings/memo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockRequireSession.mockResolvedValue({
      email: "admin@nyu.edu",
      netId: "admin",
    });
    mocks.mockResolveCallerRole.mockResolvedValue(PagePermission.ADMIN);
    mocks.mockUpdateByCalendarEventId.mockResolvedValue(undefined);
  });

  it("returns 401 without a session", async () => {
    mocks.mockRequireSession.mockResolvedValue(null);
    const res = await PUT(
      createRequest({ calendarEventId: "evt-1", memo: "WO-123" }, "mc"),
    );
    expect(res.status).toBe(401);
    expect(mocks.mockUpdateByCalendarEventId).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid JSON", async () => {
    const res = await PUT(createRequest("{not json", "mc"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when calendarEventId is missing", async () => {
    const res = await PUT(createRequest({ memo: "WO-123" }, "mc"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("calendarEventId required");
  });

  it("returns 400 when memo is not a string", async () => {
    const res = await PUT(
      createRequest({ calendarEventId: "evt-1", memo: 42 }, "mc"),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("memo must be a string");
  });

  it("returns 400 when memo exceeds the max length", async () => {
    const res = await PUT(
      createRequest(
        {
          calendarEventId: "evt-1",
          memo: "x".repeat(BOOKING_MEMO_MAX_LEN + 1),
        },
        "mc",
      ),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for an unknown tenant", async () => {
    const res = await PUT(
      createRequest({ calendarEventId: "evt-1", memo: "WO-123" }, "nope"),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid tenant");
  });

  it.each([PagePermission.BOOKING, PagePermission.PA, PagePermission.LIAISON])(
    "returns 403 for %s callers",
    async (role) => {
      mocks.mockResolveCallerRole.mockResolvedValue(role);
      const res = await PUT(
        createRequest({ calendarEventId: "evt-1", memo: "WO-123" }, "mc"),
      );
      expect(res.status).toBe(403);
      expect(mocks.mockUpdateByCalendarEventId).not.toHaveBeenCalled();
    },
  );

  it.each([
    PagePermission.SERVICES,
    PagePermission.ADMIN,
    PagePermission.SUPER_ADMIN,
  ])("writes the trimmed memo for %s callers", async (role) => {
    mocks.mockResolveCallerRole.mockResolvedValue(role);
    const res = await PUT(
      createRequest({ calendarEventId: "evt-1", memo: "  WO-123  " }, "mc"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, memo: "WO-123" });
    expect(mocks.mockResolveCallerRole).toHaveBeenCalledWith(
      { email: "admin@nyu.edu", netId: "admin" },
      "mc",
    );
    expect(mocks.mockUpdateByCalendarEventId).toHaveBeenCalledWith(
      TableNames.BOOKING,
      "evt-1",
      { memo: "WO-123" },
      "mc",
    );
  });

  it("clears the memo when an empty string is sent", async () => {
    const res = await PUT(
      createRequest({ calendarEventId: "evt-1", memo: "   " }, "mc"),
    );
    expect(res.status).toBe(200);
    expect(mocks.mockUpdateByCalendarEventId).toHaveBeenCalledWith(
      TableNames.BOOKING,
      "evt-1",
      { memo: null },
      "mc",
    );
  });

  it("falls back to the body tenant when the header is absent", async () => {
    const res = await PUT(
      createRequest({ calendarEventId: "evt-1", memo: "WO-1", tenant: "itp" }),
    );
    expect(res.status).toBe(200);
    expect(mocks.mockResolveCallerRole).toHaveBeenCalledWith(
      expect.anything(),
      "itp",
    );
  });

  it("returns 404 when the booking does not exist", async () => {
    mocks.mockUpdateByCalendarEventId.mockRejectedValue(
      new Error("Booking not found"),
    );
    const res = await PUT(
      createRequest({ calendarEventId: "evt-missing", memo: "WO-1" }, "mc"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 500 on unexpected write errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.mockUpdateByCalendarEventId.mockRejectedValue(new Error("boom"));
    const res = await PUT(
      createRequest({ calendarEventId: "evt-1", memo: "WO-1" }, "mc"),
    );
    expect(res.status).toBe(500);
  });
});
