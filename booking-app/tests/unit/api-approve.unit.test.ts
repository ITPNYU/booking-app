import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://booking.test");

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

vi.mock("@/lib/stateMachines/xstateUtilsV5", () => ({
  executeXStateTransition: vi.fn(),
}));

vi.mock("@/components/src/server/admin", () => ({
  serverApproveBooking: vi.fn(),
  finalApprove: vi.fn(),
  serverFirstApproveOnly: vi.fn(),
  serverBookingContents: vi.fn(),
}));

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetDataByCalendarEventId: vi.fn(),
  serverFetchAllDataFromCollection: vi.fn(),
  serverGetFinalApproverEmail: vi.fn(),
  serverListResourceApprovers: vi.fn(),
}));

vi.mock("@/lib/api/requireSession", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/lib/api/authz", () => ({
  resolveCallerRole: vi.fn(),
}));

vi.mock("@/components/src/server/emails", () => ({
  getTenantEmailConfig: vi.fn(async () => ({
    schemaName: "Media Commons",
    emailNotifications: {} as any,
  })),
}));

vi.mock("@/components/src/utils/tenantUtils", () => ({
  isMediaCommons: vi.fn(),
  getMediaCommonsServices: vi.fn(),
}));
import { POST } from "@/app/api/approve/route";
import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { PagePermission } from "@/components/src/types";
import {
  finalApprove,
  serverApproveBooking,
  serverBookingContents,
  serverFirstApproveOnly,
} from "@/components/src/server/admin";
import { executeXStateTransition } from "@/lib/stateMachines/xstateUtilsV5";
import {
  serverFetchAllDataFromCollection,
  serverGetFinalApproverEmail,
  serverGetDataByCalendarEventId,
  serverListResourceApprovers,
} from "@/lib/firebase/server/adminDb";
import { resolveCallerRole } from "@/lib/api/authz";
import { requireSession } from "@/lib/api/requireSession";
import {
  getMediaCommonsServices,
  isMediaCommons,
} from "@/components/src/utils/tenantUtils";

type MockRequestBody = {
  id: string;
  email: string;
};

const createRequest = (
  body: MockRequestBody,
  headers: Record<string, string> = {},
) => ({
  json: async () => body,
  headers: new Headers(headers),
});

const mockExecute = vi.mocked(executeXStateTransition);
const mockServerApproveBooking = vi.mocked(serverApproveBooking);
const mockFinalApprove = vi.mocked(finalApprove);
const mockServerFirstApproveOnly = vi.mocked(serverFirstApproveOnly);
const mockServerBookingContents = vi.mocked(serverBookingContents);
const mockServerGetDataByCalendarEventId = vi.mocked(
  serverGetDataByCalendarEventId,
);
const mockServerFetchAllDataFromCollection = vi.mocked(
  serverFetchAllDataFromCollection,
);
const mockServerGetFinalApproverEmail = vi.mocked(serverGetFinalApproverEmail);
const mockServerListResourceApprovers = vi.mocked(serverListResourceApprovers);
const mockRequireSession = vi.mocked(requireSession);
const mockResolveCallerRole = vi.mocked(resolveCallerRole);

const mockIsMediaCommons = vi.mocked(isMediaCommons);
const mockGetMediaCommonsServices = vi.mocked(getMediaCommonsServices);

const bookingId = "calendar-1";
const sessionEmail = "session-approver@nyu.edu";
const bodyEmail = "spoofed-approver@nyu.edu";

const parseJson = async (response: Response) => {
  const data = await response.json();
  return { data, status: response.status };
};

describe("POST /api/approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({
      email: sessionEmail,
      netId: "session-approver",
    } as any);
    mockResolveCallerRole.mockResolvedValue(PagePermission.ADMIN);
    mockServerGetFinalApproverEmail.mockResolvedValue(null);
    mockServerListResourceApprovers.mockResolvedValue([]);
    mockIsMediaCommons.mockReturnValue(false);
    mockGetMediaCommonsServices.mockReturnValue({
      staff: false,
      equipment: false,
      catering: false,
      cleaning: false,
      security: false,
      setup: false,
    });
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-db-id",
      requestNumber: 42,
      title: "Media Commons Session",
      email: "requester@nyu.edu",
    } as any);
    mockServerFetchAllDataFromCollection.mockResolvedValue([
      { email: "setup-approver@nyu.edu", isSetup: true },
    ] as any);
    mockServerBookingContents.mockResolvedValue({
      title: "Media Commons Session",
      requestNumber: 42,
      email: "requester@nyu.edu",
      calendarEventId: bookingId,
    } as any);
    mockFetch.mockResolvedValue({ ok: true });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireSession.mockResolvedValue(null);

    const response = await POST(
      createRequest({ id: bookingId, email: bodyEmail }) as any,
    );

    await expect(parseJson(response)).resolves.toEqual({
      status: 401,
      data: { error: "Unauthorized" },
    });
    expect(mockServerGetDataByCalendarEventId).not.toHaveBeenCalled();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid tenant", async () => {
    const response = await POST(
      createRequest(
        { id: bookingId, email: bodyEmail },
        { "x-tenant": "invalid-tenant" },
      ) as any,
    );

    await expect(parseJson(response)).resolves.toEqual({
      status: 400,
      data: { error: "Invalid tenant" },
    });
    expect(mockServerGetDataByCalendarEventId).not.toHaveBeenCalled();
  });

  it("returns 404 when the booking does not exist", async () => {
    mockServerGetDataByCalendarEventId.mockResolvedValue(null);

    const response = await POST(
      createRequest({ id: bookingId, email: bodyEmail }) as any,
    );

    await expect(parseJson(response)).resolves.toEqual({
      status: 404,
      data: { error: "Booking not found" },
    });
    expect(mockResolveCallerRole).not.toHaveBeenCalled();
  });

  it("returns 403 when the caller is not authorized", async () => {
    mockResolveCallerRole.mockResolvedValue(PagePermission.BOOKING);

    const response = await POST(
      createRequest({ id: bookingId, email: bodyEmail }) as any,
    );

    await expect(parseJson(response)).resolves.toEqual({
      status: 403,
      data: { error: "You are not authorized to approve this booking" },
    });
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("allows a liaison to perform the first approval using the session email", async () => {
    mockResolveCallerRole.mockResolvedValue(PagePermission.LIAISON);
    mockExecute.mockResolvedValue({ success: true, newState: "Pre-approved" });

    const response = await POST(
      createRequest({ id: bookingId, email: bodyEmail }) as any,
    );

    expect(mockResolveCallerRole).toHaveBeenCalledWith(
      { email: sessionEmail, netId: "session-approver" },
      DEFAULT_TENANT,
    );
    expect(mockExecute).toHaveBeenCalledWith(
      bookingId,
      "approve",
      DEFAULT_TENANT,
      sessionEmail,
    );
    expect(mockServerFirstApproveOnly).toHaveBeenCalledWith(
      bookingId,
      sessionEmail,
      DEFAULT_TENANT,
    );
    expect(response.status).toBe(200);
  });

  it("allows a resource approver to final approve only when assigned to every booking resource", async () => {
    mockResolveCallerRole.mockResolvedValue(PagePermission.BOOKING);
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-db-id",
      firstApprovedAt: "2026-06-14T12:00:00Z",
      roomId: "room-1, room-2",
    } as any);
    mockServerListResourceApprovers.mockResolvedValue([
      { resourceId: "room-1", email: sessionEmail },
      { resourceId: "room-2", email: sessionEmail.toUpperCase() },
    ] as any);
    mockExecute.mockResolvedValue({ success: true, newState: "Approved" });

    const response = await POST(
      createRequest({ id: bookingId, email: bodyEmail }) as any,
    );

    expect(mockServerListResourceApprovers).toHaveBeenCalledWith(DEFAULT_TENANT);
    expect(mockFinalApprove).toHaveBeenCalledWith(
      bookingId,
      sessionEmail,
      DEFAULT_TENANT,
    );
    expect(response.status).toBe(200);
  });

  it.each([
    ["unrelated", [{ resourceId: "room-3", email: sessionEmail }]],
    ["partially assigned", [{ resourceId: "room-1", email: sessionEmail }]],
  ])("denies a resource approver who is %s", async (_label, assignments) => {
    mockResolveCallerRole.mockResolvedValue(PagePermission.BOOKING);
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-db-id",
      firstApprovedAt: "2026-06-14T12:00:00Z",
      roomId: "room-1, room-2",
    } as any);
    mockServerListResourceApprovers.mockResolvedValue(assignments as any);

    const response = await POST(
      createRequest({ id: bookingId, email: bodyEmail }) as any,
    );

    expect(response.status).toBe(403);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("allows the tenant final approver to final approve", async () => {
    mockResolveCallerRole.mockResolvedValue(PagePermission.BOOKING);
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-db-id",
      firstApprovedAt: "2026-06-14T12:00:00Z",
      roomId: "room-1",
    } as any);
    mockServerGetFinalApproverEmail.mockResolvedValue(
      ` ${sessionEmail.toUpperCase()} `,
    );
    mockExecute.mockResolvedValue({ success: true, newState: "Approved" });

    const response = await POST(
      createRequest({ id: bookingId, email: bodyEmail }) as any,
    );

    expect(response.status).toBe(200);
    expect(mockFinalApprove).toHaveBeenCalledWith(
      bookingId,
      sessionEmail,
      DEFAULT_TENANT,
    );
    expect(mockServerListResourceApprovers).not.toHaveBeenCalled();
  });

  it.each([PagePermission.ADMIN, PagePermission.SUPER_ADMIN])(
    "allows a %s to approve",
    async (role) => {
      mockResolveCallerRole.mockResolvedValue(role);
      mockExecute.mockResolvedValue({ success: true, newState: "Approved" });

      const response = await POST(
        createRequest({ id: bookingId, email: bodyEmail }) as any,
      );

      expect(response.status).toBe(200);
      expect(mockFinalApprove).toHaveBeenCalledWith(
        bookingId,
        sessionEmail,
        DEFAULT_TENANT,
      );
    },
  );

  it("falls back to serverApproveBooking when XState transition fails", async () => {
    mockExecute.mockResolvedValue({ success: false, error: "state error" });

    const response = await POST(
      createRequest(
        { id: bookingId, email: bodyEmail },
        { "x-tenant": "itp" },
      ) as any,
    );

    expect(mockExecute).toHaveBeenCalledWith(
      bookingId,
      "approve",
      "itp",
      sessionEmail,
    );
    expect(mockServerApproveBooking).toHaveBeenCalledWith(
      bookingId,
      sessionEmail,
      "itp",
    );
    expect(mockFinalApprove).not.toHaveBeenCalled();
    expect(mockServerFirstApproveOnly).not.toHaveBeenCalled();

    await expect(parseJson(response)).resolves.toEqual({
      status: 200,
      data: { message: "Approved successfully" },
    });
  });

  it("returns 409 and does not fall back when Media Commons booking has unprocessed services", async () => {
    mockExecute.mockResolvedValue({
      success: false,
      error: "Invalid transition: Cannot execute 'approve' from state 'Services Request'",
    });
    mockIsMediaCommons.mockReturnValue(true);
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-db-id",
      staffingServicesDetails: "yes",  // requested
      staffServiceApproved: undefined, // not yet processed
    } as any);
    mockGetMediaCommonsServices.mockReturnValue({
      staff: true,
      equipment: false,
      catering: false,
      cleaning: false,
      security: false,
      setup: false,
    });

    const response = await POST(
      createRequest(
        { id: bookingId, email: bodyEmail },
        { "x-tenant": "mc" },
      ) as any,
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toMatch(/services approval flow|unprocessed/i);
    expect(mockServerApproveBooking).not.toHaveBeenCalled();
  });

  it("falls back to serverApproveBooking when Media Commons XState fails but all requested services are already processed", async () => {
    mockExecute.mockResolvedValue({
      success: false,
      error: "Invalid transition: Cannot execute 'approve' from state 'Services Request'",
    });
    mockIsMediaCommons.mockReturnValue(true);
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-db-id",
      staffingServicesDetails: "yes", // requested
      staffServiceApproved: true, // already processed (approved)
    } as any);
    mockGetMediaCommonsServices.mockReturnValue({
      staff: true,
      equipment: false,
      catering: false,
      cleaning: false,
      security: false,
      setup: false,
    });

    const response = await POST(
      createRequest(
        { id: bookingId, email: bodyEmail },
        { "x-tenant": "mc" },
      ) as any,
    );

    expect(mockServerApproveBooking).toHaveBeenCalledWith(
      bookingId,
      sessionEmail,
      "mc",
    );
    expect(response.status).toBe(200);
    await expect(parseJson(response)).resolves.toEqual({
      status: 200,
      data: { message: "Approved successfully" },
    });
  });

  it("falls back to serverApproveBooking when Media Commons XState fails and staff service was declined (already processed)", async () => {
    mockExecute.mockResolvedValue({
      success: false,
      error: "XState transition failed",
    });
    mockIsMediaCommons.mockReturnValue(true);
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-db-id",
      staffingServicesDetails: "yes", // requested
      staffServiceApproved: false, // already processed (declined)
    } as any);
    mockGetMediaCommonsServices.mockReturnValue({
      staff: true,
      equipment: false,
      catering: false,
      cleaning: false,
      security: false,
      setup: false,
    });

    const response = await POST(
      createRequest(
        { id: bookingId, email: bodyEmail },
        { "x-tenant": "mc" },
      ) as any,
    );

    expect(mockServerApproveBooking).toHaveBeenCalledWith(
      bookingId,
      sessionEmail,
      "mc",
    );
    expect(response.status).toBe(200);
  });

  it("runs finalApprove when XState reaches Approved", async () => {
    mockExecute.mockResolvedValue({ success: true, newState: "Approved" });

    const response = await POST(
      createRequest({ id: bookingId, email: bodyEmail }) as any,
    );

    expect(mockExecute).toHaveBeenCalledWith(
      bookingId,
      "approve",
      DEFAULT_TENANT,
      sessionEmail,
    );
    expect(mockFinalApprove).toHaveBeenCalledWith(
      bookingId,
      sessionEmail,
      DEFAULT_TENANT,
    );
    expect(mockServerApproveBooking).not.toHaveBeenCalled();

    await expect(parseJson(response)).resolves.toEqual({
      status: 200,
      data: { message: "Approved successfully" },
    });
  });

  it("runs serverFirstApproveOnly when XState reaches Pre-approved", async () => {
    mockExecute.mockResolvedValue({ success: true, newState: "Pre-approved" });

    const response = await POST(
      createRequest({ id: bookingId, email: bodyEmail }) as any,
    );

    expect(mockServerFirstApproveOnly).toHaveBeenCalledWith(
      bookingId,
      sessionEmail,
      DEFAULT_TENANT,
    );
    expect(mockFinalApprove).not.toHaveBeenCalled();

    await expect(parseJson(response)).resolves.toEqual({
      status: 200,
      data: { message: "Approved successfully" },
    });
  });

  it("logs services request transitions", async () => {
    mockExecute.mockResolvedValue({
      success: true,
      newState: { "Services Request": "pending" },
    });

    const response = await POST(
      createRequest(
        { id: bookingId, email: bodyEmail },
        { "x-tenant": "itp" },
      ) as any,
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "https://booking.test/api/booking-logs",
      expect.objectContaining({ method: "POST" }),
    );

    await expect(parseJson(response)).resolves.toEqual({
      status: 200,
      data: { message: "Approved successfully" },
    });
  });

  it("propagates errors when approval fails", async () => {
    mockExecute.mockResolvedValue({ success: false, error: "state error" });
    mockServerApproveBooking.mockRejectedValue(new Error("Fallback failed"));

    const response = await POST(
      createRequest({ id: bookingId, email: bodyEmail }) as any,
    );

    await expect(parseJson(response)).resolves.toEqual({
      status: 500,
      data: { error: "Fallback failed" },
    });
  });
});
