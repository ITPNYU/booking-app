import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BookingOrigin, BookingStatusLabel } from "@/components/src/types";
import { getStatusFromXState } from "@/components/src/utils/statusFromXState";

const mocks = vi.hoisted(() => ({
  getMaintenanceModeSettings: vi.fn(),
  getCachedTenantSchema: vi.fn(),
  serverGetRoomCalendarId: vi.fn(),
  insertEvent: vi.fn(),
  logServerBookingChange: vi.fn(),
  serverGetNextSequentialId: vi.fn(),
  serverSaveDataToFirestore: vi.fn(),
  serverGetFinalApproverEmail: vi.fn(),
  serverSendBookingDetailEmail: vi.fn(),
  getTenantEmailConfig: vi.fn(),
  serverGetTenantResources: vi.fn(),
  notifyServiceApproversForRequestedServices: vi.fn(),
  serverUpdateDataByCalendarEventId: vi.fn(),
}));

vi.mock("@/lib/maintenanceModeServer", () => ({
  getMaintenanceModeSettings: (...args: unknown[]) =>
    mocks.getMaintenanceModeSettings(...args),
}));

vi.mock("@/lib/tenant/getCachedTenantSchema", () => ({
  getCachedTenantSchema: (...args: unknown[]) =>
    mocks.getCachedTenantSchema(...args),
}));

vi.mock("@/lib/tenant/serverGetTenantResources", () => ({
  serverGetTenantResources: (...args: unknown[]) =>
    mocks.serverGetTenantResources(...args),
}));

vi.mock("@/components/src/client/utils/serverDate", () => ({
  toFirebaseTimestampFromString: vi.fn(() => ({ seconds: 0, nanoseconds: 0 })),
}));

vi.mock("@/components/src/server/admin", () => ({
  serverGetRoomCalendarId: (...args: unknown[]) =>
    mocks.serverGetRoomCalendarId(...args),
  serverSendBookingDetailEmail: (...args: unknown[]) =>
    mocks.serverSendBookingDetailEmail(...args),
  serverUpdateDataByCalendarEventId: (...args: unknown[]) =>
    mocks.serverUpdateDataByCalendarEventId(...args),
}));

vi.mock("@/components/src/server/serviceApproverNotifications", () => ({
  isServicesRequestState: vi.fn(() => false),
  notifyServiceApproversForRequestedServices: (...args: unknown[]) =>
    mocks.notifyServiceApproversForRequestedServices(...args),
}));

vi.mock("@/components/src/server/calendars", () => ({
  insertEvent: (...args: unknown[]) => mocks.insertEvent(...args),
}));

vi.mock("@/components/src/server/emails", () => ({
  getTenantEmailConfig: (...args: unknown[]) =>
    mocks.getTenantEmailConfig(...args),
}));

vi.mock("@/lib/firebase/server/adminDb", () => ({
  logServerBookingChange: (...args: unknown[]) =>
    mocks.logServerBookingChange(...args),
  serverFetchAllDataFromCollection: vi.fn(async () => []),
  serverGetDocumentById: vi.fn(),
  serverGetFinalApproverEmail: (...args: unknown[]) =>
    mocks.serverGetFinalApproverEmail(...args),
  serverGetNextSequentialId: (...args: unknown[]) =>
    mocks.serverGetNextSequentialId(...args),
  serverSaveDataToFirestore: (...args: unknown[]) =>
    mocks.serverSaveDataToFirestore(...args),
}));

vi.mock("@/lib/stateMachines/xstateUtilsV5", () => ({
  get executeXStateTransition() {
    throw new Error("xstate init failed");
  },
}));

vi.mock("firebase-admin/firestore", () => ({
  Timestamp: {
    now: () => ({ seconds: 1, nanoseconds: 0 }),
  },
}));

import { POST as POSTBookingsDirect } from "@/app/api/bookingsDirect/route";

const createDirectRequest = ({
  origin,
  type,
}: {
  origin: BookingOrigin;
  type: string;
}) =>
  new NextRequest("http://localhost:3000/api/bookingsDirect", {
    method: "POST",
    headers: new Headers({
      "Content-Type": "application/json",
      "x-tenant": "mc",
    }),
    body: JSON.stringify({
      email: "guest@nyu.edu",
      requestedBy: "liaison@nyu.edu",
      origin,
      type,
      selectedRooms: [{ roomId: "101", calendarId: "room-cal" }],
      bookingCalendarInfo: {
        startStr: "2026-11-01T10:00:00-04:00",
        endStr: "2026-11-01T11:00:00-04:00",
      },
      data: {
        title: "VIP shoot",
        department: "ITP",
        staffingServices: "yes",
      },
    }),
  });

describe("POST /api/bookingsDirect XState fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMaintenanceModeSettings.mockResolvedValue({ enabled: false });
    mocks.getCachedTenantSchema.mockResolvedValue(null);
    mocks.serverGetTenantResources.mockResolvedValue([]);
    mocks.serverGetRoomCalendarId.mockResolvedValue("primary-cal");
    mocks.insertEvent.mockResolvedValue({ id: "event-1" });
    mocks.serverGetNextSequentialId.mockResolvedValue(42);
    mocks.serverSaveDataToFirestore.mockResolvedValue({ id: "booking-doc" });
    mocks.logServerBookingChange.mockResolvedValue(undefined);
    mocks.serverGetFinalApproverEmail.mockResolvedValue("approver@nyu.edu");
    mocks.serverSendBookingDetailEmail.mockResolvedValue(undefined);
    mocks.getTenantEmailConfig.mockResolvedValue({
      emailNotifications: {
        approvedVIP: "Your VIP reservation is approved.",
        approvedWalkIn: "Your walk-in reservation is approved.",
      },
    });
    mocks.notifyServiceApproversForRequestedServices.mockResolvedValue(
      undefined,
    );
    mocks.serverUpdateDataByCalendarEventId.mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
      })),
    );
  });

  it("keeps a VIP booking with services pre-approved when XState init fails", async () => {
    const response = await POSTBookingsDirect(
      createDirectRequest({ origin: BookingOrigin.VIP, type: "vip" }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      result: "success",
      requestNumber: 42,
      status: BookingStatusLabel.PRE_APPROVED,
    });

    const loggedStatuses = mocks.logServerBookingChange.mock.calls.map(
      call => call[0].status,
    );
    expect(loggedStatuses).toEqual([
      BookingStatusLabel.REQUESTED,
      BookingStatusLabel.PRE_APPROVED,
    ]);
    expect(mocks.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining("[PRE-APPROVED]"),
      }),
    );
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(call => String(call[0]).includes("/api/inviteUser")),
    ).toBe(false);
    expect(mocks.serverSendBookingDetailEmail).not.toHaveBeenCalled();
    expect(
      mocks.notifyServiceApproversForRequestedServices,
    ).toHaveBeenCalledWith("event-1", "mc");
    expect(mocks.serverUpdateDataByCalendarEventId).toHaveBeenCalledWith(
      expect.anything(),
      "event-1",
      expect.objectContaining({
        firstApprovedAt: expect.anything(),
        firstApprovedBy: "liaison@nyu.edu",
      }),
      "mc",
    );
    const marker = mocks.serverUpdateDataByCalendarEventId.mock.calls[0][2];
    expect(marker).not.toHaveProperty("finalApprovedAt");
    expect(marker).not.toHaveProperty("xstateData");
    expect(getStatusFromXState(marker, "mc")).toBe(
      BookingStatusLabel.PRE_APPROVED,
    );
  });

  it("still approves a walk-in when XState init fails", async () => {
    const response = await POSTBookingsDirect(
      createDirectRequest({
        origin: BookingOrigin.WALK_IN,
        type: "walk-in",
      }),
    );
    const body = await response.json();

    expect(body.status).toBe(BookingStatusLabel.APPROVED);
    expect(mocks.serverSendBookingDetailEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        targetEmail: "guest@nyu.edu",
        status: BookingStatusLabel.APPROVED,
      }),
    );
    expect(
      mocks.notifyServiceApproversForRequestedServices,
    ).not.toHaveBeenCalled();
    expect(mocks.serverUpdateDataByCalendarEventId).toHaveBeenCalledWith(
      expect.anything(),
      "event-1",
      expect.objectContaining({
        finalApprovedAt: expect.anything(),
        finalApprovedBy: "liaison@nyu.edu",
      }),
      "mc",
    );
    const marker = mocks.serverUpdateDataByCalendarEventId.mock.calls[0][2];
    expect(getStatusFromXState(marker, "mc")).toBe(BookingStatusLabel.APPROVED);
  });
});
