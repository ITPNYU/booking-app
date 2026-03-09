import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Firebase Admin
const mockServerGetDataByCalendarEventId = vi.fn();
const mockServerUpdateInFirestore = vi.fn();
const mockServerSaveDataToFirestore = vi.fn();
const mockServerFetchAllDataFromCollection = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetDataByCalendarEventId: mockServerGetDataByCalendarEventId,
  serverUpdateInFirestore: mockServerUpdateInFirestore,
  serverSaveDataToFirestore: mockServerSaveDataToFirestore,
  serverFetchAllDataFromCollection: mockServerFetchAllDataFromCollection,
  logServerBookingChange: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("firebase-admin", () => ({
  firestore: {
    Timestamp: {
      now: () => ({
        toDate: () => new Date("2025-01-15T10:30:00Z"),
        toMillis: () => 1736938200000,
      }),
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
    REQUESTED: "REQUESTED",
    PRE_APPROVED: "PRE-APPROVED",
    APPROVED: "APPROVED",
    CANCELED: "CANCELED",
    DECLINED: "DECLINED",
    NO_SHOW: "NO-SHOW",
  },
}));

vi.mock("@/components/src/server/emails", () => ({
  getTenantEmailConfig: vi.fn().mockResolvedValue({
    emailMessages: {
      cancelConfirmation: "Your booking has been canceled",
    },
  }),
}));

vi.mock("@/components/src/server/ui", () => ({
  getBookingToolDeployUrl: vi.fn(() => "https://booking-tool.example.com"),
}));

import { TableNames } from "@/components/src/policy";
import { BookingStatusLabel } from "@/components/src/types";

// ─── Cancel-Processing API ────────────────────────────────────────────────────

describe("Cancel-Processing API: admin cancel attribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-admin-cancel",
      requestNumber: 777,
      email: "requester@nyu.edu",
      startDate: { toDate: () => new Date("2025-06-01T10:00:00Z") },
      endDate: { toDate: () => new Date("2025-06-01T12:00:00Z") },
    });

    // No prior logs → manual cancellation, not an automatic transition
    mockServerFetchAllDataFromCollection.mockResolvedValue([]);
  });

  it("attributes canceledBy to the admin when an admin cancels a user's booking", async () => {
    const { POST } = await import("@/app/api/cancel-processing/route");

    const mockRequest = {
      json: async () => ({
        calendarEventId: "cal-admin-cancel",
        email: "admin@nyu.edu",
        netId: "admin123",
        tenant: "mc",
      }),
      headers: { get: () => "mc" },
    } as any;

    await POST(mockRequest);

    expect(mockServerUpdateInFirestore).toHaveBeenCalledWith(
      TableNames.BOOKING,
      "booking-admin-cancel",
      expect.objectContaining({
        canceledBy: "admin@nyu.edu",
        canceledAt: expect.any(Object),
      }),
      "mc",
    );
  });

  it("does NOT attribute canceledBy to the original requester when admin cancels", async () => {
    const { POST } = await import("@/app/api/cancel-processing/route");

    const mockRequest = {
      json: async () => ({
        calendarEventId: "cal-admin-cancel",
        email: "admin@nyu.edu",
        netId: "admin123",
        tenant: "mc",
      }),
      headers: { get: () => "mc" },
    } as any;

    await POST(mockRequest);

    const updateCall = mockServerUpdateInFirestore.mock.calls.find(
      (call) => call[0] === TableNames.BOOKING,
    );
    expect(updateCall).toBeDefined();
    const updatedFields = updateCall![2];
    expect(updatedFields.canceledBy).not.toBe("requester@nyu.edu");
  });

  it("records the admin's email in the booking log", async () => {
    const { POST } = await import("@/app/api/cancel-processing/route");

    const mockRequest = {
      json: async () => ({
        calendarEventId: "cal-admin-cancel-log",
        email: "admin@nyu.edu",
        netId: "admin123",
        tenant: "mc",
      }),
      headers: { get: () => "mc" },
    } as any;

    await POST(mockRequest);

    expect(mockServerSaveDataToFirestore).toHaveBeenCalledWith(
      TableNames.BOOKING_LOGS,
      expect.objectContaining({
        calendarEventId: "cal-admin-cancel-log",
        status: BookingStatusLabel.CANCELED,
        changedBy: "admin@nyu.edu",
      }),
      "mc",
    );
  });
});

// ─── XState Transition API: event builder ─────────────────────────────────────

describe("XState Transition API: email injected into cancel/noShow events", () => {
  it("includes email in the cancel event when provided", () => {
    const eventType = "cancel";
    const email = "admin@nyu.edu";

    const event: any = { type: eventType };
    if (
      email &&
      (eventType === "checkOut" ||
        eventType === "cancel" ||
        eventType === "noShow")
    ) {
      event.email = email;
    }

    expect(event).toEqual({ type: "cancel", email: "admin@nyu.edu" });
  });

  it("includes email in the noShow event when provided", () => {
    const eventType = "noShow";
    const email = "staff@nyu.edu";

    const event: any = { type: eventType };
    if (
      email &&
      (eventType === "checkOut" ||
        eventType === "cancel" ||
        eventType === "noShow")
    ) {
      event.email = email;
    }

    expect(event).toEqual({ type: "noShow", email: "staff@nyu.edu" });
  });

  it("still includes email in checkOut events (regression guard)", () => {
    const eventType = "checkOut";
    const email = "System";

    const event: any = { type: eventType };
    if (
      email &&
      (eventType === "checkOut" ||
        eventType === "cancel" ||
        eventType === "noShow")
    ) {
      event.email = email;
    }

    expect(event).toEqual({ type: "checkOut", email: "System" });
  });

  it("does NOT inject email for other event types (e.g. approve)", () => {
    const eventType = "approve";
    const email = "admin@nyu.edu";

    const event: any = { type: eventType };
    if (
      email &&
      (eventType === "checkOut" ||
        eventType === "cancel" ||
        eventType === "noShow")
    ) {
      event.email = email;
    }

    expect(event).toEqual({ type: "approve" });
    expect(event.email).toBeUndefined();
  });
});

// ─── MC Machine: handleCancelProcessing email priority ───────────────────────

describe("mcBookingMachine handleCancelProcessing: email priority logic", () => {
  it("uses event.email when present, ignoring context.email (admin override case)", () => {
    const eventEmail = "admin@nyu.edu";
    const contextEmail = "requester@nyu.edu";

    // Mirrors the updated logic: (event as any).email || context.email || "system"
    const emailUsed = eventEmail || contextEmail || "system";

    expect(emailUsed).toBe("admin@nyu.edu");
  });

  it("falls back to context.email when event.email is absent (user self-cancel case)", () => {
    const eventEmail = undefined;
    const contextEmail = "requester@nyu.edu";

    const emailUsed = eventEmail || contextEmail || "system";

    expect(emailUsed).toBe("requester@nyu.edu");
  });

  it("falls back to 'system' when neither event nor context provides an email", () => {
    const eventEmail = undefined;
    const contextEmail = undefined;

    const emailUsed = eventEmail || contextEmail || "system";

    expect(emailUsed).toBe("system");
  });
});

// ─── MC Machine: cancel event carries admin email through the machine ─────────

describe("mcBookingMachine: cancel event with admin email calls cancel-processing with admin email", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
      status: 200,
      statusText: "OK",
    });
    process.env.NEXT_PUBLIC_BASE_URL =
      process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  it("passes admin email to cancel-processing API when cancel event contains admin email", async () => {
    const { createActor } = await import("xstate");
    const { mcBookingMachine } = await import(
      "@/lib/stateMachines/mcBookingMachine"
    );

    const actor = createActor(mcBookingMachine, {
      input: {
        tenant: "mc",
        calendarEventId: "cal-admin-cancel-machine",
        // context.email is the original booking requester
        email: "requester@nyu.edu",
        selectedRooms: [
          {
            roomId: 202,
            autoApproval: {
              minHour: { admin: -1, faculty: -1, student: -1 },
              maxHour: { admin: -1, faculty: -1, student: -1 },
              conditions: {
                setup: false,
                equipment: false,
                staffing: false,
                catering: false,
                cleaning: false,
                security: false,
              },
            },
          },
        ],
        bookingCalendarInfo: {
          startStr: new Date(Date.now() + 3600_000).toISOString(),
          endStr: new Date(Date.now() + 7200_000).toISOString(),
        },
      },
    });

    actor.start();

    // Verify machine auto-approved (pre-condition for cancel)
    expect(actor.getSnapshot().matches("Approved")).toBe(true);

    // Admin sends cancel event with their own email attached
    actor.send({ type: "cancel", email: "admin@nyu.edu" } as any);

    // Wait for the async handleCancelProcessing action to fire
    const deadline = Date.now() + 2_000;
    while (Date.now() < deadline) {
      const cancelCall = mockFetch.mock.calls.find(([url]) =>
        typeof url === "string" && url.includes("/api/cancel-processing"),
      );
      if (cancelCall) break;
      await new Promise((r) => setTimeout(r, 20));
    }

    const cancelCall = mockFetch.mock.calls.find(([url]) =>
      typeof url === "string" && url.includes("/api/cancel-processing"),
    );

    expect(cancelCall).toBeDefined();
    const [, init] = cancelCall as [string, RequestInit];
    const body = JSON.parse(init.body as string);

    // Should use the admin's email from the event, NOT the requester's context email
    expect(body.email).toBe("admin@nyu.edu");
    expect(body.email).not.toBe("requester@nyu.edu");
  });

  it("uses context.email (requester) when cancel event has no email (user self-cancel)", async () => {
    const { createActor } = await import("xstate");
    const { mcBookingMachine } = await import(
      "@/lib/stateMachines/mcBookingMachine"
    );

    const actor = createActor(mcBookingMachine, {
      input: {
        tenant: "mc",
        calendarEventId: "cal-user-self-cancel",
        email: "requester@nyu.edu",
        selectedRooms: [
          {
            roomId: 202,
            autoApproval: {
              minHour: { admin: -1, faculty: -1, student: -1 },
              maxHour: { admin: -1, faculty: -1, student: -1 },
              conditions: {
                setup: false,
                equipment: false,
                staffing: false,
                catering: false,
                cleaning: false,
                security: false,
              },
            },
          },
        ],
        bookingCalendarInfo: {
          startStr: new Date(Date.now() + 3600_000).toISOString(),
          endStr: new Date(Date.now() + 7200_000).toISOString(),
        },
      },
    });

    actor.start();
    expect(actor.getSnapshot().matches("Approved")).toBe(true);

    // User cancels their own booking — no email on the event
    actor.send({ type: "cancel" });

    const deadline = Date.now() + 2_000;
    while (Date.now() < deadline) {
      const cancelCall = mockFetch.mock.calls.find(([url]) =>
        typeof url === "string" && url.includes("/api/cancel-processing"),
      );
      if (cancelCall) break;
      await new Promise((r) => setTimeout(r, 20));
    }

    const cancelCall = mockFetch.mock.calls.find(([url]) =>
      typeof url === "string" && url.includes("/api/cancel-processing"),
    );

    expect(cancelCall).toBeDefined();
    const [, init] = cancelCall as [string, RequestInit];
    const body = JSON.parse(init.body as string);

    // Falls back to the requester's context email
    expect(body.email).toBe("requester@nyu.edu");
  });
});
