import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mockGetMaintenanceModeSettings: vi.fn(),
  mockInsertEvent: vi.fn(),
  mockServerGetTenantResources: vi.fn(),
}));

vi.mock("@/lib/maintenanceModeServer", () => ({
  getMaintenanceModeSettings: (...args: unknown[]) =>
    mocks.mockGetMaintenanceModeSettings(...args),
}));

vi.mock("@/components/src/client/utils/serverDate", () => ({
  toFirebaseTimestampFromString: vi.fn(),
}));

vi.mock("@/components/src/server/admin", () => ({
  firstApproverEmails: vi.fn(),
  serverApproveInstantBooking: vi.fn(),
  serverGetRoomCalendarId: vi.fn(),
  serverSendBookingDetailEmail: vi.fn(),
  serverUpdateDataByCalendarEventId: vi.fn(),
}));

vi.mock("@/components/src/server/serviceApproverNotifications", () => ({
  isServicesRequestState: vi.fn(),
  notifyServiceApproversForRequestedServices: vi.fn(),
}));

vi.mock("@/components/src/server/calendars", () => ({
  bookingContentsToDescription: vi.fn(),
  insertEvent: (...args: unknown[]) => mocks.mockInsertEvent(...args),
}));

vi.mock("@/components/src/server/emails", () => ({
  getTenantEmailConfig: vi.fn(),
}));

vi.mock("@/lib/firebase/server/adminDb", () => ({
  logServerBookingChange: vi.fn(),
  serverGetFinalApproverEmail: vi.fn(),
  serverGetNextSequentialId: vi.fn(),
  serverSaveDataToFirestore: vi.fn(),
  serverGetDocumentById: vi.fn(),
}));

vi.mock("@/lib/stateMachines/itpBookingMachine", () => ({
  itpBookingMachine: { id: "itp" },
}));

vi.mock("@/lib/stateMachines/mcBookingMachine", () => ({
  mcBookingMachine: { id: "mc" },
}));

vi.mock("xstate", () => ({
  createActor: vi.fn(),
}));

vi.mock("@/app/lib/sendHTMLEmail", () => ({
  sendHTMLEmail: vi.fn(),
}));

vi.mock("@/lib/googleClient", () => ({
  getCalendarClient: vi.fn(),
}));

vi.mock("@/lib/utils/calendarEnvironment", () => ({
  applyEnvironmentCalendarIds: vi.fn((resources) => resources),
}));

vi.mock("@/lib/bookingRequestLimits", () => ({
  enforceRequestLimits: vi.fn(),
  getRequestLimitRoleKey: vi.fn(),
}));

vi.mock("@/lib/tenant/serverGetTenantResources", () => ({
  serverGetTenantResources: (...args: unknown[]) =>
    mocks.mockServerGetTenantResources(...args),
}));

import { POST as POSTBookingsDirect } from "@/app/api/bookingsDirect/route";
import { POST } from "@/app/api/bookings/route";
import { getCalendarClient } from "@/lib/googleClient";

const createPostRequest = () =>
  new NextRequest("http://localhost:3000/api/bookings", {
    method: "POST",
    headers: new Headers({
      "Content-Type": "application/json",
      "x-tenant": "mc",
    }),
    body: JSON.stringify({
      email: "requester@nyu.edu",
      selectedRooms: [],
      bookingCalendarInfo: null,
      data: {},
      isAutoApproval: false,
    }),
  });

const createDirectPostRequest = (
  headers: Record<string, string> = { "x-tenant": "mc" },
) =>
  new NextRequest("http://localhost:3000/api/bookingsDirect", {
    method: "POST",
    headers: new Headers({
      "Content-Type": "application/json",
      ...headers,
    }),
    body: JSON.stringify({
      email: "requester@nyu.edu",
      selectedRooms: [],
      bookingCalendarInfo: null,
      data: {},
    }),
  });

describe("POST /api/bookings maintenance mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 503 before creating a booking when maintenance mode is enabled", async () => {
    mocks.mockGetMaintenanceModeSettings.mockResolvedValue({
      enabled: true,
      message: "Requests are paused.",
    });

    const response = await POST(createPostRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: "Requests are paused.",
      maintenanceMode: true,
    });
    expect(mocks.mockGetMaintenanceModeSettings).toHaveBeenCalledWith("mc");
    expect(mocks.mockInsertEvent).not.toHaveBeenCalled();
  });

  it("returns 503 before creating a direct booking when maintenance mode is enabled", async () => {
    mocks.mockGetMaintenanceModeSettings.mockResolvedValue({
      enabled: true,
      message: "Requests are paused.",
    });

    const response = await POSTBookingsDirect(createDirectPostRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: "Requests are paused.",
      maintenanceMode: true,
    });
    expect(mocks.mockGetMaintenanceModeSettings).toHaveBeenCalledWith("mc");
    expect(mocks.mockInsertEvent).not.toHaveBeenCalled();
  });

  it("checks default tenant maintenance mode for direct bookings without tenant signals", async () => {
    mocks.mockGetMaintenanceModeSettings.mockResolvedValue({
      enabled: true,
      message: "Requests are paused.",
    });

    const response = await POSTBookingsDirect(createDirectPostRequest({}));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: "Requests are paused.",
      maintenanceMode: true,
    });
    expect(mocks.mockGetMaintenanceModeSettings).toHaveBeenCalledWith("mc");
    expect(mocks.mockInsertEvent).not.toHaveBeenCalled();
  });
});

describe("submit conflict check", () => {
  const overlappingCalendar = () => ({
    events: {
      list: vi.fn().mockResolvedValue({
        data: {
          items: [
            {
              id: "someone-else",
              iCalUID: "other-ical",
              summary: "[APPROVED] 202 Taken",
              start: { dateTime: "2026-05-05T15:00:00.000Z" },
              end: { dateTime: "2026-05-05T17:00:00.000Z" },
            },
          ],
        },
      }),
      get: vi.fn().mockResolvedValue({ data: {} }),
    },
  });

  const conflictBody = {
    email: "requester@nyu.edu",
    selectedRooms: [{ roomId: "202", calendarId: "room-cal" }],
    bookingCalendarInfo: {
      startStr: "2026-05-05T14:00:00.000Z",
      endStr: "2026-05-05T16:00:00.000Z",
    },
    data: { title: "Walk-in", role: "Faculty", department: "ITP" },
  };

  const post = (url: string) =>
    new NextRequest(url, {
      method: "POST",
      headers: new Headers({
        "Content-Type": "application/json",
        "x-tenant": "mc",
      }),
      body: JSON.stringify(conflictBody),
    });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockGetMaintenanceModeSettings.mockResolvedValue({
      enabled: false,
      message: "",
    });
    mocks.mockServerGetTenantResources.mockResolvedValue([
      { resourceId: "202", calendarId: "server-cal" },
    ]);
    vi.mocked(getCalendarClient).mockResolvedValue(overlappingCalendar() as never);
  });

  it("rejects a walk-in or VIP against the schema calendar, not the client calendar id", async () => {
    const list = vi.fn().mockResolvedValue({
      data: {
        items: [
          {
            id: "someone-else",
            iCalUID: "other-ical",
            summary: "[APPROVED] 202 Taken",
            start: { dateTime: "2026-05-05T15:00:00.000Z" },
            end: { dateTime: "2026-05-05T17:00:00.000Z" },
          },
        ],
      },
    });
    vi.mocked(getCalendarClient).mockResolvedValue({
      events: { list, get: vi.fn().mockResolvedValue({ data: {} }) },
    } as never);

    const response = await POSTBookingsDirect(
      post("http://localhost:3000/api/bookingsDirect"),
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Time slot no longer available",
    });
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ calendarId: "server-cal" }),
    );
    expect(list).not.toHaveBeenCalledWith(
      expect.objectContaining({ calendarId: "room-cal" }),
    );
    expect(mocks.mockInsertEvent).not.toHaveBeenCalled();
  });

  it("rejects a walk-in when the room has no schema calendar", async () => {
    mocks.mockServerGetTenantResources.mockResolvedValue([]);
    const response = await POSTBookingsDirect(
      post("http://localhost:3000/api/bookingsDirect"),
    );
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      result: "error",
      message: "ROOM CALENDAR ID NOT FOUND",
    });
    expect(getCalendarClient).not.toHaveBeenCalled();
    expect(mocks.mockInsertEvent).not.toHaveBeenCalled();
  });

  it("rejects a walk-in or VIP when the slot is already booked", async () => {
    const response = await POSTBookingsDirect(
      post("http://localhost:3000/api/bookingsDirect"),
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Time slot no longer available",
    });
    expect(mocks.mockInsertEvent).not.toHaveBeenCalled();
  });

  it("rejects a user request against the schema calendar, not the client calendar id", async () => {
    const list = vi.fn().mockResolvedValue({
      data: {
        items: [
          {
            id: "someone-else",
            iCalUID: "other-ical",
            summary: "[APPROVED] 202 Taken",
            start: { dateTime: "2026-05-05T15:00:00.000Z" },
            end: { dateTime: "2026-05-05T17:00:00.000Z" },
          },
        ],
      },
    });
    vi.mocked(getCalendarClient).mockResolvedValue({
      events: { list, get: vi.fn().mockResolvedValue({ data: {} }) },
    } as never);

    const response = await POST(post("http://localhost:3000/api/bookings"));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Time slot no longer available",
    });
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ calendarId: "server-cal" }),
    );
    expect(list).not.toHaveBeenCalledWith(
      expect.objectContaining({ calendarId: "room-cal" }),
    );
    expect(mocks.mockInsertEvent).not.toHaveBeenCalled();
  });
});
