import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  shouldBypassAuth: vi.fn(),
  serverBookingContents: vi.fn(),
  serverSendBookingDetailEmail: vi.fn(),
  serverSendConfirmationEmail: vi.fn(),
  serverUpdateDataByCalendarEventId: vi.fn(),
  updateCalendarEvent: vi.fn(),
  getTenantEmailConfig: vi.fn(),
  getApprovalCcEmail: vi.fn(),
  logServerBookingChange: vi.fn(),
  serverFetchAllDataFromCollection: vi.fn(),
  serverGetDataByCalendarEventId: vi.fn(),
  serverSaveDataToFirestore: vi.fn(),
  timestampNow: vi.fn(() => ({ seconds: 1, nanoseconds: 0 })),
}));

vi.mock("@/lib/api/requireSession", () => ({
  requireSession: mocks.requireSession,
}));

vi.mock("@/lib/utils/testEnvironment", () => ({
  shouldBypassAuth: mocks.shouldBypassAuth,
}));

vi.mock("@/components/src/server/admin", () => ({
  serverBookingContents: mocks.serverBookingContents,
  serverSendBookingDetailEmail: mocks.serverSendBookingDetailEmail,
  serverSendConfirmationEmail: mocks.serverSendConfirmationEmail,
  serverUpdateDataByCalendarEventId: mocks.serverUpdateDataByCalendarEventId,
}));

vi.mock("@/components/src/server/calendars", () => ({
  updateCalendarEvent: mocks.updateCalendarEvent,
}));

vi.mock("@/components/src/server/emails", () => ({
  getTenantEmailConfig: mocks.getTenantEmailConfig,
}));

vi.mock("@/components/src/tenantPolicyServer", () => ({
  getApprovalCcEmail: mocks.getApprovalCcEmail,
}));

vi.mock("@/lib/firebase/server/adminDb", () => ({
  logServerBookingChange: mocks.logServerBookingChange,
  serverFetchAllDataFromCollection: mocks.serverFetchAllDataFromCollection,
  serverGetDataByCalendarEventId: mocks.serverGetDataByCalendarEventId,
  serverSaveDataToFirestore: mocks.serverSaveDataToFirestore,
}));

vi.mock("firebase-admin/firestore", () => ({
  Timestamp: { now: mocks.timestampNow },
}));

import { POST } from "@/app/api/noshow-processing/route";
import { TableNames } from "@/components/src/policy";
import { BookingStatusLabel } from "@/components/src/types";

const createRequest = (body: Record<string, unknown>) =>
  ({
    json: async () => body,
    headers: new Headers({ "x-tenant": "mc" }),
  }) as any;

describe("POST /api/noshow-processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({
      email: "nw2289@nyu.edu",
      netId: "nw2289",
    });
    mocks.shouldBypassAuth.mockReturnValue(false);
    mocks.serverGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-7007",
      requestNumber: 7007,
      email: "rz3233@nyu.edu",
      netId: "rz3233",
      roomId: "room-1",
      startDate: {},
      requestedAt: {},
    });
    mocks.serverFetchAllDataFromCollection.mockResolvedValue([]);
    mocks.getTenantEmailConfig.mockResolvedValue({
      emailNotifications: { noShow: "No show (${violationCount})" },
    });
    mocks.getApprovalCcEmail.mockResolvedValue(undefined);
    mocks.serverBookingContents.mockResolvedValue({});
  });

  it("rejects unauthenticated direct requests before reading the booking", async () => {
    mocks.requireSession.mockResolvedValue(null);

    const response = await POST(
      createRequest({
        calendarEventId: "calendar-7007",
        email: "forged@nyu.edu",
        netId: "forged",
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.serverGetDataByCalendarEventId).not.toHaveBeenCalled();
    expect(mocks.serverUpdateDataByCalendarEventId).not.toHaveBeenCalled();
  });

  it("uses the session actor and the booking owner despite forged body identities", async () => {
    const response = await POST(
      createRequest({
        calendarEventId: "calendar-7007",
        email: "forged-actor@nyu.edu",
        netId: "forged-owner",
        tenant: "itp",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.serverUpdateDataByCalendarEventId).toHaveBeenCalledWith(
      TableNames.BOOKING,
      "calendar-7007",
      expect.objectContaining({ noShowedBy: "nw2289@nyu.edu" }),
      "mc",
    );
    expect(mocks.logServerBookingChange).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "booking-7007",
        status: BookingStatusLabel.NO_SHOW,
        changedBy: "nw2289@nyu.edu",
        requestNumber: 7007,
        tenant: "mc",
      }),
    );
    expect(mocks.serverSaveDataToFirestore).toHaveBeenCalledWith(
      TableNames.PRE_BAN_LOGS,
      expect.objectContaining({
        bookingId: "calendar-7007",
        netId: "rz3233",
      }),
      "mc",
    );
  });
});
