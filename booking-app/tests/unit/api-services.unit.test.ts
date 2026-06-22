import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/requireSession", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/lib/api/authz", () => ({
  resolveCallerRole: vi.fn(),
}));

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetDataByCalendarEventId: vi.fn(),
  serverIsServiceApprover: vi.fn(),
}));

vi.mock("@/lib/stateMachines/xstateUtilsV5", () => ({
  executeXStateTransition: vi.fn(),
}));

import { POST } from "@/app/api/services/route";
import { PagePermission } from "@/components/src/types";
import { resolveCallerRole } from "@/lib/api/authz";
import { requireSession } from "@/lib/api/requireSession";
import {
  serverGetDataByCalendarEventId,
  serverIsServiceApprover,
} from "@/lib/firebase/server/adminDb";
import { executeXStateTransition } from "@/lib/stateMachines/xstateUtilsV5";

const mockRequireSession = vi.mocked(requireSession);
const mockResolveCallerRole = vi.mocked(resolveCallerRole);
const mockServerGetDataByCalendarEventId = vi.mocked(
  serverGetDataByCalendarEventId,
);
const mockServerIsServiceApprover = vi.mocked(serverIsServiceApprover);
const mockExecuteXStateTransition = vi.mocked(executeXStateTransition);

const request = (
  body: Record<string, unknown>,
  headers: Record<string, string> = { "x-tenant": "mc" },
) =>
  ({
    json: async () => body,
    headers: new Headers(headers),
  }) as any;

const parseJson = async (response: Response) => ({
  status: response.status,
  body: await response.json(),
});

describe("POST /api/services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({
      email: "service@nyu.edu",
      netId: "service",
    });
    mockResolveCallerRole.mockResolvedValue(PagePermission.BOOKING);
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-id",
      requestNumber: 12,
      roomId: "room-a, room-b",
    } as any);
    mockServerIsServiceApprover.mockResolvedValue(true);
    mockExecuteXStateTransition.mockResolvedValue({
      success: true,
      newState: { "Services Request": "pending" },
    } as any);
    global.fetch = vi.fn(async () => ({ ok: true })) as unknown as typeof fetch;
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireSession.mockResolvedValue(null);

    const response = await POST(
      request({ calendarEventId: "cal", serviceType: "setup", action: "approve" }),
    );

    await expect(parseJson(response)).resolves.toEqual({
      status: 401,
      body: { error: "Unauthorized" },
    });
  });

  it("returns 403 when caller is not assigned to the requested service", async () => {
    mockServerIsServiceApprover.mockResolvedValue(false);

    const response = await POST(
      request({ calendarEventId: "cal", serviceType: "setup", action: "approve" }),
    );

    expect(mockServerIsServiceApprover).toHaveBeenCalledWith(
      "service@nyu.edu",
      "setup",
      "mc",
    );
    expect(mockExecuteXStateTransition).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
  });

  it("uses the session email and ignores spoofed body email", async () => {
    const response = await POST(
      request({
        calendarEventId: "cal",
        serviceType: "equipment",
        action: "approve",
        email: "spoof@nyu.edu",
      }),
    );

    expect(mockExecuteXStateTransition).toHaveBeenCalledWith(
      "cal",
      "approveEquipment",
      "mc",
      "service@nyu.edu",
    );
    expect(response.status).toBe(200);
  });

  it("allows admins without a service assignment", async () => {
    mockResolveCallerRole.mockResolvedValue(PagePermission.ADMIN);
    mockServerIsServiceApprover.mockResolvedValue(false);

    const response = await POST(
      request({ calendarEventId: "cal", serviceType: "setup", action: "decline" }),
    );

    expect(mockServerIsServiceApprover).not.toHaveBeenCalled();
    expect(mockExecuteXStateTransition).toHaveBeenCalledWith(
      "cal",
      "declineSetup",
      "mc",
      "service@nyu.edu",
    );
    expect(response.status).toBe(200);
  });

  it("returns 404 when the booking does not exist", async () => {
    mockServerGetDataByCalendarEventId.mockResolvedValue(null);

    const response = await POST(
      request({ calendarEventId: "missing", serviceType: "setup", action: "approve" }),
    );

    await expect(parseJson(response)).resolves.toEqual({
      status: 404,
      body: { error: "Booking not found" },
    });
  });
});
