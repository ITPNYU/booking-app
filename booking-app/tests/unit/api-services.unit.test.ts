import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/requireSession", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/lib/api/authz", () => ({
  resolveCallerRole: vi.fn(),
}));

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetDataByCalendarEventId: vi.fn(),
  serverIsEquipmentApprover: vi.fn(),
  serverIsServiceApproverForAllResources: vi.fn(),
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
  serverIsEquipmentApprover,
  serverIsServiceApproverForAllResources,
} from "@/lib/firebase/server/adminDb";
import { executeXStateTransition } from "@/lib/stateMachines/xstateUtilsV5";

const mockRequireSession = vi.mocked(requireSession);
const mockResolveCallerRole = vi.mocked(resolveCallerRole);
const mockServerGetDataByCalendarEventId = vi.mocked(
  serverGetDataByCalendarEventId,
);
const mockServerIsEquipmentApprover = vi.mocked(serverIsEquipmentApprover);
const mockServerIsServiceApproverForAllResources = vi.mocked(
  serverIsServiceApproverForAllResources,
);
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
    mockServerIsServiceApproverForAllResources.mockResolvedValue(true);
    mockServerIsEquipmentApprover.mockResolvedValue(false);
    mockExecuteXStateTransition.mockResolvedValue({
      success: true,
      newState: { "Services Request": "pending" },
    } as any);
    global.fetch = vi.fn(async () => ({ ok: true })) as unknown as typeof fetch;
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireSession.mockResolvedValue(null);

    const response = await POST(
      request({
        calendarEventId: "cal",
        serviceType: "setup",
        action: "approve",
      }),
    );

    await expect(parseJson(response)).resolves.toEqual({
      status: 401,
      body: { error: "Unauthorized" },
    });
  });

  it("returns 403 when caller is not assigned to every booked resource", async () => {
    mockServerIsServiceApproverForAllResources.mockResolvedValue(false);

    const response = await POST(
      request({
        calendarEventId: "cal",
        serviceType: "setup",
        action: "approve",
      }),
    );

    expect(mockServerIsServiceApproverForAllResources).toHaveBeenCalledWith(
      "service@nyu.edu",
      ["room-a", "room-b"],
      "setup",
      "mc",
    );
    expect(mockServerIsEquipmentApprover).toHaveBeenCalledWith(
      "service@nyu.edu",
      "mc",
    );
    expect(mockExecuteXStateTransition).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
  });

  it("allows existing equipment approvers for equipment without a per-resource service assignment", async () => {
    mockServerIsServiceApproverForAllResources.mockResolvedValue(false);
    mockServerIsEquipmentApprover.mockResolvedValue(true);

    const response = await POST(
      request({
        calendarEventId: "cal",
        serviceType: "equipment",
        action: "approve",
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

  it("does not allow existing equipment approvers for non-equipment services", async () => {
    mockServerIsServiceApproverForAllResources.mockResolvedValue(false);
    mockServerIsEquipmentApprover.mockResolvedValue(true);

    const response = await POST(
      request({
        calendarEventId: "cal",
        serviceType: "setup",
        action: "approve",
      }),
    );

    expect(mockServerIsEquipmentApprover).not.toHaveBeenCalled();
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
    mockServerIsServiceApproverForAllResources.mockResolvedValue(false);

    const response = await POST(
      request({
        calendarEventId: "cal",
        serviceType: "setup",
        action: "decline",
      }),
    );

    expect(mockServerIsServiceApproverForAllResources).not.toHaveBeenCalled();
    expect(mockExecuteXStateTransition).toHaveBeenCalledWith(
      "cal",
      "declineSetup",
      "mc",
      "service@nyu.edu",
    );
    expect(response.status).toBe(200);
  });

  it("allows PA users to close out services without a service assignment", async () => {
    mockResolveCallerRole.mockResolvedValue(PagePermission.PA);
    mockServerIsServiceApproverForAllResources.mockResolvedValue(false);

    const response = await POST(
      request({
        calendarEventId: "cal",
        serviceType: "setup",
        action: "closeout",
      }),
    );

    expect(mockServerIsServiceApproverForAllResources).not.toHaveBeenCalled();
    expect(mockExecuteXStateTransition).toHaveBeenCalledWith(
      "cal",
      "closeoutSetup",
      "mc",
      "service@nyu.edu",
    );
    expect(response.status).toBe(200);
  });

  it("does not allow PA users to approve services without a service assignment", async () => {
    mockResolveCallerRole.mockResolvedValue(PagePermission.PA);
    mockServerIsServiceApproverForAllResources.mockResolvedValue(false);

    const response = await POST(
      request({
        calendarEventId: "cal",
        serviceType: "setup",
        action: "approve",
      }),
    );

    expect(mockServerIsServiceApproverForAllResources).toHaveBeenCalledWith(
      "service@nyu.edu",
      ["room-a", "room-b"],
      "setup",
      "mc",
    );
    expect(mockExecuteXStateTransition).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
  });

  it("returns 404 when the booking does not exist", async () => {
    mockServerGetDataByCalendarEventId.mockResolvedValue(null);

    const response = await POST(
      request({
        calendarEventId: "missing",
        serviceType: "setup",
        action: "approve",
      }),
    );

    await expect(parseJson(response)).resolves.toEqual({
      status: 404,
      body: { error: "Booking not found" },
    });
  });

  it("returns structured JSON when authorization lookup fails", async () => {
    mockResolveCallerRole.mockRejectedValue(new Error("firestore unavailable"));

    const response = await POST(
      request({
        calendarEventId: "cal",
        serviceType: "setup",
        action: "approve",
      }),
    );

    await expect(parseJson(response)).resolves.toEqual({
      status: 500,
      body: { error: "firestore unavailable" },
    });
  });
});
