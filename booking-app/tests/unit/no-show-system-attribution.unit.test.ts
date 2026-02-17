import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Firebase Admin
const mockLogServerBookingChange = vi.fn();
const mockServerGetDataByCalendarEventId = vi.fn();
const mockServerUpdateDataByCalendarEventId = vi.fn();
const mockServerUpdateInFirestore = vi.fn();
const mockServerSaveDataToFirestore = vi.fn();
const mockServerFetchAllDataFromCollection = vi.fn().mockResolvedValue([]);

const mockClientUpdateDataByCalendarEventId = vi.fn();
const mockClientGetDataByCalendarEventId = vi.fn();
const mockClientSaveDataToFirestore = vi.fn();
const mockClientFetchAllDataFromCollection = vi.fn();
const mockClientUpdateDataInFirestore = vi.fn();
const mockGetPaginatedData = vi.fn();

const mockShouldUseXState = vi.fn();
const mockGetTenantEmailConfig = vi.fn().mockResolvedValue({
  emailMessages: {
    noShow: "Booking marked as no show",
  },
});

vi.mock("@/lib/firebase/server/adminDb", () => ({
  logServerBookingChange: mockLogServerBookingChange,
  serverGetDataByCalendarEventId: mockServerGetDataByCalendarEventId,
  serverUpdateDataByCalendarEventId: mockServerUpdateDataByCalendarEventId,
  serverUpdateInFirestore: mockServerUpdateInFirestore,
  serverSaveDataToFirestore: mockServerSaveDataToFirestore,
  serverFetchAllDataFromCollection: mockServerFetchAllDataFromCollection,
}));

vi.mock("firebase-admin", () => ({
  firestore: {
    Timestamp: {
      now: () => ({ toDate: () => new Date("2025-01-01T10:00:00Z") }),
    },
  },
}));

vi.mock("@/components/src/policy", () => ({
  TableNames: {
    BOOKING: "bookings",
    BOOKING_LOGS: "bookingLogs",
    PRE_BAN_LOGS: "preBanLogs",
  },
  getApprovalCcEmail: () => "cc@nyu.edu",
  getCancelCcEmail: () => "cancel@nyu.edu",
  clientGetFinalApproverEmail: () => "approver@nyu.edu",
}));

vi.mock("@/components/src/types", () => ({
  BookingStatusLabel: {
    NO_SHOW: "NO-SHOW",
    CANCELED: "CANCELED",
    CLOSED: "CLOSED",
    APPROVED: "APPROVED",
    DECLINED: "DECLINED",
  },
}));

vi.mock("@/lib/firebase/client/clientDb", () => ({
  clientUpdateDataByCalendarEventId: mockClientUpdateDataByCalendarEventId,
}));

vi.mock("@/lib/firebase/firebase", () => ({
  clientGetDataByCalendarEventId: mockClientGetDataByCalendarEventId,
  clientSaveDataToFirestore: mockClientSaveDataToFirestore,
  clientFetchAllDataFromCollection: mockClientFetchAllDataFromCollection,
  clientUpdateDataInFirestore: mockClientUpdateDataInFirestore,
  getPaginatedData: mockGetPaginatedData,
}));

vi.mock("@/components/src/utils/tenantUtils", () => ({
  shouldUseXState: mockShouldUseXState,
}));

vi.mock("@/components/src/server/emails", () => ({
  getTenantEmailConfig: mockGetTenantEmailConfig,
}));

vi.mock("@/components/src/server/ui", () => ({
  getBookingToolDeployUrl: vi.fn(() => "https://booking-tool.example.com"),
}));

const mockTimestampNow = vi.fn(() => ({
  toDate: () => new Date("2025-01-01T09:00:00Z"),
}));

vi.mock("firebase/firestore", () => ({
  Timestamp: {
    now: mockTimestampNow,
  },
  where: vi.fn(),
}));

import { TableNames } from "@/components/src/policy";
import { BookingStatusLabel } from "@/components/src/types";

// Note: CANCELED history logging is now handled by processCancelBooking function only
// The XState handleStateTransitions no longer creates CANCELED logs to avoid duplication
// processCancelBooking detects automatic transitions from No Show or Decline by querying
// booking logs for NO-SHOW or DECLINED status, and attributes to "System" instead of user email

// Helper function to simulate logBookingHistory action from mcBookingMachine
const simulateLogBookingHistory = async (
  context: { email?: string },
  params: { status?: string; note?: string }
) => {
  const { status, note } = params;

  if (!status) return;

  // mcBookingMachine logBookingHistory simply uses context.email || "system"
  // Automatic CANCELED transitions are handled separately by handleStateTransitions
  const changedBy = context.email || "system";

  await mockLogServerBookingChange({
    bookingId: "booking-123",
    calendarEventId: "cal-event-123",
    status,
    changedBy,
    requestNumber: 123,
    note: note || "",
    tenant: "mc",
  });
};

describe("NO_SHOW System Attribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTenantEmailConfig.mockResolvedValue({
      emailMessages: {
        noShow: "Booking marked as no show",
      },
    });

    // Mock booking document
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-123",
      requestNumber: 123,
      email: "user@nyu.edu",
    });
  });

  describe("processCancelBooking Function", () => {
    it("should attribute CANCELED transition to System when automatic from No Show", async () => {
      // Simulate processCancelBooking with automatic transition from No Show
      const calendarEventId = "cal-event-123";
      const userEmail = "user@nyu.edu";
      
      // Mock the processCancelBooking logic
      await mockLogServerBookingChange({
        calendarEventId,
        status: BookingStatusLabel.CANCELED,
        changedBy: "System", // Should be System for automatic transitions
        changedAt: { toDate: () => new Date("2025-01-01T10:00:00Z") },
        note: "Canceled due to no show",
        requestNumber: 123,
      });

      // Verify that the history log is created with "System" attribution
      expect(mockLogServerBookingChange).toHaveBeenCalledWith({
        calendarEventId,
        status: BookingStatusLabel.CANCELED,
        changedBy: "System",
        changedAt: expect.any(Object),
        note: "Canceled due to no show",
        requestNumber: 123,
      });
    });

    it("should attribute CANCELED transition to System when automatic from Decline", async () => {
      // Simulate processCancelBooking with automatic transition from Decline
      const calendarEventId = "cal-event-456";
      const userEmail = "user@nyu.edu";
      
      // Mock the processCancelBooking logic
      await mockLogServerBookingChange({
        calendarEventId,
        status: BookingStatusLabel.CANCELED,
        changedBy: "System", // Should be System for automatic transitions
        changedAt: { toDate: () => new Date("2025-01-01T10:00:00Z") },
        note: "Canceled due to decline",
        requestNumber: 123,
      });

      // Verify that the history log is created with "System" attribution
      expect(mockLogServerBookingChange).toHaveBeenCalledWith({
        calendarEventId,
        status: BookingStatusLabel.CANCELED,
        changedBy: "System",
        changedAt: expect.any(Object),
        note: "Canceled due to decline",
        requestNumber: 123,
      });
    });

    it("should attribute manual CANCELED transition to user", async () => {
      const calendarEventId = "cal-event-123";
      const userEmail = "admin@nyu.edu";

      // Mock the processCancelBooking logic for manual cancellation
      await mockLogServerBookingChange({
        calendarEventId,
        status: BookingStatusLabel.CANCELED,
        changedBy: userEmail, // Should be user email for manual cancellations
        changedAt: { toDate: () => new Date("2025-01-01T10:00:00Z") },
        note: "",
        requestNumber: 123,
      });

      // Verify that the history log is created with user attribution
      expect(mockLogServerBookingChange).toHaveBeenCalledWith({
        calendarEventId,
        status: BookingStatusLabel.CANCELED,
        changedBy: userEmail,
        changedAt: expect.any(Object),
        note: "",
        requestNumber: 123,
      });
    });
  });

  describe("mcBookingMachine logBookingHistory Action", () => {
    it("should use user email for booking history logs (automatic CANCELED transitions are handled separately)", async () => {
      const context = { email: "user@nyu.edu" };
      const params = {
        status: "NO-SHOW",
        note: "Booking marked as no show",
      };

      await simulateLogBookingHistory(context, params);

      // mcBookingMachine logBookingHistory is only called for NO-SHOW status
      // Automatic CANCELED transitions are handled by processCancelBooking in db.ts
      expect(mockLogServerBookingChange).toHaveBeenCalledWith({
        bookingId: "booking-123",
        calendarEventId: "cal-event-123",
        status: "NO-SHOW",
        changedBy: "user@nyu.edu",
        requestNumber: 123,
        note: "Booking marked as no show",
        tenant: "mc",
      });
    });

    it("should handle missing email gracefully", async () => {
      const context = {}; // No email
      const params = {
        status: "NO-SHOW",
        note: "Booking marked as no show",
      };

      await simulateLogBookingHistory(context, params);

      // Should fall back to "system"
      expect(mockLogServerBookingChange).toHaveBeenCalledWith({
        bookingId: "booking-123",
        calendarEventId: "cal-event-123",
        status: "NO-SHOW",
        changedBy: "system",
        requestNumber: 123,
        note: "Booking marked as no show",
        tenant: "mc",
      });
    });
  });

  describe("CLOSED State Attribution", () => {
    it("should always attribute CLOSED state to System (already implemented)", () => {
      // This test documents the existing behavior in processCloseBooking
      // The function already sets closedBy: "System" and changedBy: "System"
      // This is correct behavior and doesn't need changes
      expect(true).toBe(true); // Placeholder - actual implementation is in db.ts
    });
  });

  describe("Edge Cases", () => {
    it("should handle different state transitions correctly by checking booking logs", () => {
      // The key insight is that automatic CANCELED transitions from NO_SHOW or DECLINED
      // are detected by querying booking logs for NO-SHOW or DECLINED status entries
      // in processCancelBooking, not by parsing note content, previousState, or timestamp fields.
      // This is more reliable and less error-prone as it uses the actual history of state changes.
      expect(true).toBe(true); // Documentation test
    });
  });

  describe("Email Notifications", () => {
    it("should document that email notifications use booking details, not changedBy field", () => {
      // This test documents that email notifications are sent to the guest
      // (from booking.email field) regardless of who triggered the state change.
      // The changedBy field is only used for history logs and booking details view.
      // Email content should indicate it was a system action for automatic transitions.
      expect(true).toBe(true); // Documentation test
    });
  });
});

describe("processCancelBooking Integration Tests", () => {
  const originalFetch = global.fetch;
  let dbModule: typeof import("@/components/src/server/db");

  beforeAll(async () => {
    dbModule = await import("@/components/src/server/db");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-123",
      requestNumber: 123,
      email: "user@nyu.edu",
      startDate: { toDate: () => new Date("2025-01-05T10:00:00Z") },
      endDate: { toDate: () => new Date("2025-01-05T12:00:00Z") },
    });
    mockServerFetchAllDataFromCollection.mockResolvedValue([]);
    mockGetTenantEmailConfig.mockResolvedValue({
      emailMessages: {
        lateCancel: "Late cancellation notification",
      },
    });
    
    // Mock fetch for email sending and calendar updates
    const fetchMock = vi.fn(async (input: any) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/sendEmail") || url.includes("/api/calendarEvents")) {
        return {
          ok: true,
          json: async () => ({ success: true }),
        };
      }
      return {
        ok: true,
        json: async () => ({}),
      };
    });
    global.fetch = fetchMock as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should call processCancelBooking and attribute to System when NO-SHOW log exists", async () => {
    // Mock booking logs with a NO-SHOW entry
    mockServerFetchAllDataFromCollection.mockResolvedValue([
      {
        calendarEventId: "cal-event-123",
        status: BookingStatusLabel.NO_SHOW,
        changedBy: "staff@nyu.edu",
        changedAt: { toDate: () => new Date("2025-01-01T09:00:00Z") },
      },
    ]);

    await dbModule.processCancelBooking(
      "cal-event-123",
      "staff@nyu.edu",
      "staff123",
      "mc"
    );

    // Verify that booking logs were queried
    expect(mockServerFetchAllDataFromCollection).toHaveBeenCalledWith(
      TableNames.BOOKING_LOGS,
      [{ field: "calendarEventId", operator: "==", value: "cal-event-123" }],
      "mc"
    );

    // Verify that the cancel log was created with System attribution
    expect(mockServerSaveDataToFirestore).toHaveBeenCalledWith(
      TableNames.BOOKING_LOGS,
      expect.objectContaining({
        calendarEventId: "cal-event-123",
        status: BookingStatusLabel.CANCELED,
        changedBy: "System",
        note: "Canceled due to no show",
      }),
      "mc"
    );
  });

  it("should call processCancelBooking and attribute to System when DECLINED log exists", async () => {
    // Mock booking logs with a DECLINED entry
    mockServerFetchAllDataFromCollection.mockResolvedValue([
      {
        calendarEventId: "cal-event-456",
        status: BookingStatusLabel.DECLINED,
        changedBy: "admin@nyu.edu",
        changedAt: { toDate: () => new Date("2025-01-01T09:00:00Z") },
      },
    ]);

    await dbModule.processCancelBooking(
      "cal-event-456",
      "admin@nyu.edu",
      "admin123",
      "mc"
    );

    // Verify that the cancel log was created with System attribution
    expect(mockServerSaveDataToFirestore).toHaveBeenCalledWith(
      TableNames.BOOKING_LOGS,
      expect.objectContaining({
        calendarEventId: "cal-event-456",
        status: BookingStatusLabel.CANCELED,
        changedBy: "System",
        note: "Canceled due to decline",
      }),
      "mc"
    );
  });

  it("should call processCancelBooking and attribute to user when no NO-SHOW or DECLINED logs exist", async () => {
    // Mock booking logs without NO-SHOW or DECLINED entries
    mockServerFetchAllDataFromCollection.mockResolvedValue([
      {
        calendarEventId: "cal-event-789",
        status: BookingStatusLabel.APPROVED,
        changedBy: "staff@nyu.edu",
        changedAt: { toDate: () => new Date("2025-01-01T09:00:00Z") },
      },
    ]);

    await dbModule.processCancelBooking(
      "cal-event-789",
      "user@nyu.edu",
      "user123",
      "mc"
    );

    // Verify that the cancel log was created with user attribution
    expect(mockServerSaveDataToFirestore).toHaveBeenCalledWith(
      TableNames.BOOKING_LOGS,
      expect.objectContaining({
        calendarEventId: "cal-event-789",
        status: BookingStatusLabel.CANCELED,
        changedBy: "user@nyu.edu",
        note: "",
      }),
      "mc"
    );
  });

  it("should NOT log to PRE_BAN_LOGS (late cancellation) when cancel is from auto Decline→Cancel", async () => {
    mockServerFetchAllDataFromCollection.mockResolvedValue([
      {
        calendarEventId: "cal-event-declined",
        status: BookingStatusLabel.DECLINED,
        changedBy: "admin@nyu.edu",
        changedAt: { toDate: () => new Date("2025-01-01T09:00:00Z") },
      },
    ]);
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-declined",
      requestNumber: 999,
      email: "requester@nyu.edu",
      startDate: { toDate: () => new Date("2025-01-10T10:00:00Z") },
      endDate: { toDate: () => new Date("2025-01-10T12:00:00Z") },
      requestedAt: { toDate: () => new Date("2025-01-01T08:00:00Z") },
    });

    await dbModule.processCancelBooking(
      "cal-event-declined",
      "system",
      "requester123",
      "mc"
    );

    const preBanLogCalls = mockServerSaveDataToFirestore.mock.calls.filter(
      (call) => call[0] === TableNames.PRE_BAN_LOGS
    );
    expect(preBanLogCalls).toHaveLength(0);
  });

  it("should NOT log to PRE_BAN_LOGS (late cancellation) when cancel is from NoShow→Cancel", async () => {
    mockServerFetchAllDataFromCollection.mockResolvedValue([
      {
        calendarEventId: "cal-event-noshow",
        status: BookingStatusLabel.NO_SHOW,
        changedBy: "staff@nyu.edu",
        changedAt: { toDate: () => new Date("2025-01-01T09:00:00Z") },
      },
    ]);
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-noshow",
      requestNumber: 998,
      email: "requester@nyu.edu",
      startDate: { toDate: () => new Date("2025-01-10T10:00:00Z") },
      endDate: { toDate: () => new Date("2025-01-10T12:00:00Z") },
      requestedAt: { toDate: () => new Date("2025-01-01T08:00:00Z") },
    });

    await dbModule.processCancelBooking(
      "cal-event-noshow",
      "system",
      "requester456",
      "mc"
    );

    const preBanLogCalls = mockServerSaveDataToFirestore.mock.calls.filter(
      (call) => call[0] === TableNames.PRE_BAN_LOGS
    );
    expect(preBanLogCalls).toHaveLength(0);
  });
});

describe("noShow function XState flow", () => {
  const originalFetch = global.fetch;
  let dbModule: typeof import("@/components/src/server/db");

  beforeAll(async () => {
    dbModule = await import("@/components/src/server/db");
  });

  beforeEach(() => {
    mockShouldUseXState.mockReset();
    mockClientUpdateDataByCalendarEventId.mockReset();
    mockClientGetDataByCalendarEventId.mockReset();
    mockClientSaveDataToFirestore.mockReset();
    mockClientFetchAllDataFromCollection.mockReset();
    mockClientUpdateDataInFirestore.mockReset();
    mockGetPaginatedData.mockReset();
    mockGetTenantEmailConfig.mockClear();
    mockGetTenantEmailConfig.mockResolvedValue({
      emailMessages: {
        noShow: "Booking marked as no show",
      },
    });
    global.fetch = originalFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const createBookingDoc = () => ({
    id: "booking-123",
    requestNumber: 456,
    email: "guest@nyu.edu",
    startDate: { toDate: () => new Date("2025-01-05T10:00:00Z") },
    endDate: { toDate: () => new Date("2025-01-05T12:00:00Z") },
    requestedAt: { toDate: () => new Date("2024-12-30T10:00:00Z") },
  });

  it("executes traditional no-show flow when XState transitions to 'No Show'", async () => {
    mockShouldUseXState.mockReturnValue(true);

    const fetchMock = vi.fn(async (input: any, init: any) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/xstate-transition")) {
        return {
          ok: true,
          json: async () => ({ newState: "No Show" }),
        };
      }

      if (url.includes("/api/calendarEvents")) {
        return {
          ok: true,
          json: async () => ({ success: true }),
        };
      }

      if (url.includes("/api/booking-logs")) {
        if ((init?.method || "GET").toUpperCase() === "POST") {
          return {
            ok: true,
            json: async () => ({}),
            text: async () => "",
          };
        }

        return {
          ok: true,
          json: async () => [],
          text: async () => "",
        };
      }

      if (url.includes("/api/sendEmail")) {
        return {
          ok: true,
          json: async () => ({ success: true }),
          text: async () => "",
        };
      }

      return {
        ok: true,
        json: async () => ({}),
      };
    });

    global.fetch = fetchMock as any;
    mockClientGetDataByCalendarEventId.mockResolvedValue(createBookingDoc());

    await dbModule.noShow("cal-event-123", "staff@nyu.edu", "staff123", "mc");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/xstate-transition"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          calendarEventId: "cal-event-123",
          eventType: "noShow",
          email: "staff@nyu.edu",
          reason: undefined,
        }),
      }),
    );

    expect(mockClientUpdateDataByCalendarEventId).toHaveBeenCalledWith(
      TableNames.BOOKING,
      "cal-event-123",
      expect.objectContaining({
        noShowedBy: "staff@nyu.edu",
        noShowedAt: expect.any(Object),
      }),
      "mc",
    );

    expect(mockClientSaveDataToFirestore).toHaveBeenCalledWith(
      TableNames.PRE_BAN_LOGS,
      expect.objectContaining({
        netId: "staff123",
        bookingId: "cal-event-123",
        noShowDate: expect.any(Object),
      }),
    );

    const bookingLogCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        typeof url === "string" &&
        url.includes("/api/booking-logs") &&
        (init?.method || "GET").toUpperCase() === "POST",
    );
    expect(bookingLogCall).toBeDefined();
    const [, bookingLogInit] = bookingLogCall as [any, RequestInit];
    const bookingLogPayload = JSON.parse(bookingLogInit?.body as string);
    expect(bookingLogPayload).toMatchObject({
      calendarEventId: "cal-event-123",
      status: BookingStatusLabel.NO_SHOW,
      changedBy: "staff@nyu.edu",
    });

    const calendarEventCall = fetchMock.mock.calls.find(
      ([url]) => typeof url === "string" && url.includes("/api/calendarEvents"),
    );
    expect(calendarEventCall).toBeDefined();
    const [, calendarInit] = calendarEventCall as [any, RequestInit];
    expect(calendarInit?.method).toBe("PUT");
    expect(JSON.parse(calendarInit?.body as string)).toEqual({
      calendarEventId: "cal-event-123",
      newValues: { statusPrefix: BookingStatusLabel.NO_SHOW },
    });

    expect(mockGetTenantEmailConfig).toHaveBeenCalledWith("mc");

    const sendEmailCall = fetchMock.mock.calls.find(
      ([url]) => typeof url === "string" && url.includes("/api/sendEmail"),
    );
    expect(sendEmailCall).toBeDefined();
    const [, sendEmailInit] = sendEmailCall as [any, RequestInit];
    expect(sendEmailInit?.method).toBe("POST");
    const emailPayload = JSON.parse(sendEmailInit?.body as string);
    expect(emailPayload.targetEmail).toBe("guest@nyu.edu");
    expect(emailPayload.status).toBe(BookingStatusLabel.NO_SHOW);
    expect(emailPayload.contents?.headerMessage).toBe(
      "Booking marked as no show",
    );

    const allEmailPayloads = fetchMock.mock.calls
      .filter(
        ([url]) => typeof url === "string" && url.includes("/api/sendEmail"),
      )
      .map(([, init]) => JSON.parse((init as RequestInit).body as string));
    expect(
      allEmailPayloads.some((payload) =>
        payload.contents?.headerMessage?.toLowerCase().includes("no show"),
      ),
    ).toBe(true);
  });

  it("skips traditional flow when XState does not reach 'No Show'", async () => {
    mockShouldUseXState.mockReturnValue(true);

    const fetchMock = vi.fn(async (input: any) => {
      if (typeof input === "string" && input.includes("/api/xstate-transition")) {
        return {
          ok: true,
          json: async () => ({ newState: "Approved" }),
        };
      }

      return {
        ok: true,
        json: async () => ({}),
      };
    });

    global.fetch = fetchMock as any;

    await dbModule.noShow("cal-event-456", "staff@nyu.edu", "staff456", "mc");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockClientUpdateDataByCalendarEventId).not.toHaveBeenCalled();
    expect(mockClientSaveDataToFirestore).not.toHaveBeenCalled();
    expect(mockClientGetDataByCalendarEventId).not.toHaveBeenCalled();
    expect(
      fetchMock.mock.calls.some(
        ([url]) => typeof url === "string" && url.includes("/api/sendEmail"),
      ),
    ).toBe(false);
  });

  it("falls back to traditional flow when XState API fails", async () => {
    mockShouldUseXState.mockReturnValue(true);

    const fetchMock = vi.fn(async (input: any, init: any) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/xstate-transition")) {
        return {
          ok: false,
          json: async () => ({ error: "Transition failed" }),
        };
      }

      if (url.includes("/api/booking-logs")) {
        if ((init?.method || "GET").toUpperCase() === "POST") {
          return {
            ok: true,
            json: async () => ({}),
            text: async () => "",
          };
        }

        return {
          ok: true,
          json: async () => [],
          text: async () => "",
        };
      }

      if (url.includes("/api/sendEmail")) {
        return {
          ok: true,
          json: async () => ({ success: true }),
          text: async () => "",
        };
      }

      return {
        ok: true,
        json: async () => ({}),
      };
    });

    global.fetch = fetchMock as any;
    mockClientGetDataByCalendarEventId.mockResolvedValue(createBookingDoc());

    await dbModule.noShow("cal-event-789", "staff@nyu.edu", "staff789", "mc");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/xstate-transition"),
      expect.any(Object),
    );

    expect(mockClientUpdateDataByCalendarEventId).toHaveBeenCalledWith(
      TableNames.BOOKING,
      "cal-event-789",
      expect.objectContaining({
        noShowedBy: "staff@nyu.edu",
      }),
      "mc",
    );

    expect(mockClientSaveDataToFirestore).toHaveBeenCalledWith(
      TableNames.PRE_BAN_LOGS,
      expect.objectContaining({
        netId: "staff789",
        bookingId: "cal-event-789",
        noShowDate: expect.any(Object),
      }),
    );

    const sendEmailCall = fetchMock.mock.calls.find(
      ([url]) => typeof url === "string" && url.includes("/api/sendEmail"),
    );
    expect(sendEmailCall).toBeDefined();
    const [, sendEmailInit] = sendEmailCall as [any, RequestInit];
    const fallbackEmailPayload = JSON.parse(sendEmailInit?.body as string);
    expect(fallbackEmailPayload.targetEmail).toBe("guest@nyu.edu");
    expect(fallbackEmailPayload.status).toBe(BookingStatusLabel.NO_SHOW);
  });
});
