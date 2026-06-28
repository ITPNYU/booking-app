import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mockGetMaintenanceModeSettings: vi.fn(),
  mockInsertEvent: vi.fn(),
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

import { POST } from "@/app/api/bookings/route";

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
});
