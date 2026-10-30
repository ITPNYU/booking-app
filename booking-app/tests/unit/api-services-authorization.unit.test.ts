import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://booking.test");

vi.mock("@/lib/api/requireSession", () => ({ requireSession: vi.fn() }));
vi.mock("@/lib/api/authz", () => ({ resolveCallerRole: vi.fn() }));
vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetDataByCalendarEventId: vi.fn(),
}));
vi.mock("@/lib/firebase/server/serviceApprovers", () => ({
  serverResolveServiceApproverEmails: vi.fn(),
}));
vi.mock("@/lib/stateMachines/xstateUtilsV5", () => ({
  executeXStateTransition: vi.fn(),
}));

import { POST } from "@/app/api/services/route";
import { PagePermission } from "@/components/src/types";
import { resolveCallerRole } from "@/lib/api/authz";
import { requireSession } from "@/lib/api/requireSession";
import { serverGetDataByCalendarEventId } from "@/lib/firebase/server/adminDb";
import { serverResolveServiceApproverEmails } from "@/lib/firebase/server/serviceApprovers";
import { executeXStateTransition } from "@/lib/stateMachines/xstateUtilsV5";

const mockRequireSession = vi.mocked(requireSession);
const mockResolveCallerRole = vi.mocked(resolveCallerRole);
const mockGetBooking = vi.mocked(serverGetDataByCalendarEventId);
const mockResolveApprovers = vi.mocked(serverResolveServiceApproverEmails);
const mockExecute = vi.mocked(executeXStateTransition);

const sessionEmail = "carol@nyu.edu";

const request = (body: Record<string, unknown>, tenant = "mc") =>
  ({
    json: async () => body,
    headers: new Headers({ "x-tenant": tenant }),
  }) as any;

const approveEquipment = {
  calendarEventId: "cal-1",
  serviceType: "equipment",
  action: "approve",
  email: "spoofed@nyu.edu",
};

describe("POST /api/services authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({}) })),
    );
    mockRequireSession.mockResolvedValue({
      email: sessionEmail,
      netId: "carol",
    });
    mockResolveCallerRole.mockResolvedValue(PagePermission.SERVICES);
    mockGetBooking.mockResolvedValue({
      id: "booking-1",
      requestNumber: 7,
      roomId: "202, 1201",
    });
    mockResolveApprovers.mockResolvedValue([]);
    mockExecute.mockResolvedValue({
      success: true,
      newState: { "Services Request": {} },
    } as any);
  });

  it("rejects a request without a session", async () => {
    mockRequireSession.mockResolvedValue(null);
    const res = await POST(request(approveEquipment));
    expect(res.status).toBe(401);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("returns 400 for a body that isn't JSON", async () => {
    const res = await POST({
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
      headers: new Headers({ "x-tenant": "mc" }),
    } as any);
    expect(res.status).toBe(400);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("rejects an unknown tenant", async () => {
    const res = await POST(request(approveEquipment, "nope"));
    expect(res.status).toBe(400);
  });

  it("forbids someone who isn't the service's approver on any booked room", async () => {
    mockResolveApprovers.mockResolvedValue(["dan@nyu.edu"]);

    const res = await POST(request(approveEquipment));

    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(
      "You are not an approver for the Equipment service on this request",
    );
    expect(mockResolveApprovers).toHaveBeenCalledWith(
      "202, 1201",
      "equipment",
      "mc",
      "act",
    );
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("lets a booked room's service approver act, as the session user", async () => {
    mockResolveApprovers.mockResolvedValue(["dan@nyu.edu", sessionEmail]);

    const res = await POST(request(approveEquipment));

    expect(res.status).toBe(200);
    expect(mockExecute).toHaveBeenCalledWith(
      "cal-1",
      "approveEquipment",
      "mc",
      sessionEmail,
    );
  });

  it.each([PagePermission.ADMIN, PagePermission.SUPER_ADMIN])(
    "lets a %s decide any service",
    async (role) => {
      mockResolveCallerRole.mockResolvedValue(role);

      const res = await POST(
        request({ ...approveEquipment, action: "decline", reason: "n/a" }),
      );

      expect(res.status).toBe(200);
      expect(mockResolveApprovers).not.toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalledWith(
        "cal-1",
        "declineEquipment",
        "mc",
        sessionEmail,
      );
    },
  );

  it("returns 404 for an unknown booking", async () => {
    mockGetBooking.mockResolvedValue(null);
    const res = await POST(request(approveEquipment));
    expect(res.status).toBe(404);
  });
});
