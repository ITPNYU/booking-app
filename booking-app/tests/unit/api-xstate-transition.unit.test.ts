import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/stateMachines/xstateUtilsV5", () => ({
  executeXStateTransition: vi.fn(),
  getAvailableXStateTransitions: vi.fn(),
}));

vi.mock("@/lib/api/requireSession", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/lib/utils/testEnvironment", () => ({
  shouldBypassAuth: vi.fn(),
}));

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetDataByCalendarEventId: vi.fn(),
}));

vi.mock("@/lib/api/bookingDecisionAuthz", () => ({
  authorizeBookingDecision: vi.fn(),
}));

import { POST } from "@/app/api/xstate-transition/route";
import { authorizeBookingDecision } from "@/lib/api/bookingDecisionAuthz";
import { requireSession } from "@/lib/api/requireSession";
import { serverGetDataByCalendarEventId } from "@/lib/firebase/server/adminDb";
import { executeXStateTransition } from "@/lib/stateMachines/xstateUtilsV5";
import { shouldBypassAuth } from "@/lib/utils/testEnvironment";

const mockExecuteXStateTransition = vi.mocked(executeXStateTransition);
const mockRequireSession = vi.mocked(requireSession);
const mockShouldBypassAuth = vi.mocked(shouldBypassAuth);
const mockAuthorizeBookingDecision = vi.mocked(authorizeBookingDecision);
const mockServerGetDataByCalendarEventId = vi.mocked(
  serverGetDataByCalendarEventId,
);

const createRequest = (body: Record<string, unknown>) =>
  ({
    json: async () => body,
    headers: new Headers({ "x-tenant": "mc" }),
  }) as any;

describe("POST /api/xstate-transition no-show attribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({
      email: "operator@nyu.edu",
      netId: "operator",
    });
    mockShouldBypassAuth.mockReturnValue(false);
    mockExecuteXStateTransition.mockResolvedValue({
      success: true,
      newState: "Closed",
    });
  });

  it("uses the authenticated operator instead of the student in the body", async () => {
    const response = await POST(
      createRequest({
        calendarEventId: "calendar-123",
        eventType: "noShow",
        email: "student@nyu.edu",
        netId: "student",
      }),
    );

    expect(response.status).toBe(200);
    expect(mockExecuteXStateTransition).toHaveBeenCalledWith(
      "calendar-123",
      "noShow",
      "mc",
      "operator@nyu.edu",
      undefined,
      "operator",
      undefined,
    );
  });

  it("retains an explicit mocked operator identity during E2E auth bypass", async () => {
    mockShouldBypassAuth.mockReturnValue(true);

    await POST(
      createRequest({
        calendarEventId: "calendar-123",
        eventType: "noShow",
        email: "e2e-operator@nyu.edu",
        netId: "e2e-operator",
      }),
    );

    expect(mockExecuteXStateTransition).toHaveBeenCalledWith(
      "calendar-123",
      "noShow",
      "mc",
      "e2e-operator@nyu.edu",
      undefined,
      "e2e-operator",
      undefined,
    );
  });

  it("rejects an unauthenticated no-show transition", async () => {
    mockRequireSession.mockResolvedValue(null);

    const response = await POST(
      createRequest({
        calendarEventId: "calendar-123",
        eventType: "noShow",
        email: "student@nyu.edu",
      }),
    );

    expect(response.status).toBe(401);
    expect(mockExecuteXStateTransition).not.toHaveBeenCalled();
  });
});

describe("POST /api/xstate-transition edit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteXStateTransition.mockResolvedValue({
      success: true,
      newState: "Requested",
    });
  });

  it("passes the changed services on to the machine, dropping unknown keys", async () => {
    const response = await POST(
      createRequest({
        calendarEventId: "calendar-123",
        eventType: "edit",
        email: "user@nyu.edu",
        changedServices: ["catering", "not-a-service", "staff"],
      }),
    );

    expect(response.status).toBe(200);
    expect(mockExecuteXStateTransition).toHaveBeenCalledWith(
      "calendar-123",
      "edit",
      "mc",
      "user@nyu.edu",
      undefined,
      undefined,
      ["catering", "staff"],
    );
  });
});

describe("POST /api/xstate-transition decline", () => {
  const booking = {
    id: "booking-db-id",
    roomId: "room-1",
    firstApprovedAt: "2026-10-17T12:00:00Z",
  };
  const declineRequest = () =>
    createRequest({
      calendarEventId: "calendar-123",
      eventType: "decline",
      email: "someone-else@nyu.edu",
      reason: "No staff available",
    });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({
      email: "approver@nyu.edu",
      netId: "approver",
    });
    mockShouldBypassAuth.mockReturnValue(false);
    mockServerGetDataByCalendarEventId.mockResolvedValue(booking);
    mockAuthorizeBookingDecision.mockResolvedValue(true);
    mockExecuteXStateTransition.mockResolvedValue({
      success: true,
      newState: "Declined",
    });
  });

  it("declines for an approver and records the session user", async () => {
    const response = await POST(declineRequest());

    expect(response.status).toBe(200);
    expect(mockServerGetDataByCalendarEventId).toHaveBeenCalledWith(
      "bookings",
      "calendar-123",
      "mc",
    );
    expect(mockAuthorizeBookingDecision).toHaveBeenCalledWith(
      "approver@nyu.edu",
      "mc",
      booking,
      "decline",
    );
    expect(mockExecuteXStateTransition).toHaveBeenCalledWith(
      "calendar-123",
      "decline",
      "mc",
      "approver@nyu.edu",
      "No staff available",
      "approver",
      undefined,
    );
  });

  it("returns 403 and does not decline for a user who is not an approver", async () => {
    mockAuthorizeBookingDecision.mockResolvedValue(false);

    const response = await POST(declineRequest());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "You are not authorized to decline this booking",
    });
    expect(mockExecuteXStateTransition).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated decline", async () => {
    mockRequireSession.mockResolvedValue(null);

    const response = await POST(declineRequest());

    expect(response.status).toBe(401);
    expect(mockServerGetDataByCalendarEventId).not.toHaveBeenCalled();
    expect(mockExecuteXStateTransition).not.toHaveBeenCalled();
  });

  it("returns 404 when the booking does not exist", async () => {
    mockServerGetDataByCalendarEventId.mockResolvedValue(null);

    const response = await POST(declineRequest());

    expect(response.status).toBe(404);
    expect(mockAuthorizeBookingDecision).not.toHaveBeenCalled();
    expect(mockExecuteXStateTransition).not.toHaveBeenCalled();
  });

  it("does not run the decline check for other transitions", async () => {
    mockExecuteXStateTransition.mockResolvedValue({
      success: true,
      newState: "Checked In",
    });

    const response = await POST(
      createRequest({
        calendarEventId: "calendar-123",
        eventType: "checkIn",
        email: "pa@nyu.edu",
      }),
    );

    expect(response.status).toBe(200);
    expect(mockAuthorizeBookingDecision).not.toHaveBeenCalled();
  });
});
