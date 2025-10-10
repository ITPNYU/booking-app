import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetDataByCalendarEventId: vi.fn(),
  logServerBookingChange: vi.fn(),
}));

vi.mock("@/components/src/server/admin", () => ({
  serverUpdateDataByCalendarEventId: vi.fn(),
  serverBookingContents: vi.fn(),
  serverSendBookingDetailEmail: vi.fn(),
}));

vi.mock("@/components/src/server/calendars", () => ({
  updateCalendarEvent: vi.fn(),
}));

vi.mock("@/components/src/policy", () => ({
  TableNames: {
    BOOKING: "BOOKING",
  },
}));

vi.mock("firebase-admin/firestore", () => ({
  Timestamp: {
    now: vi.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
  },
}));

import { POST } from "@/app/api/checkout-processing/route";
import { BookingStatusLabel } from "@/components/src/types";
import {
  serverBookingContents,
  serverSendBookingDetailEmail,
  serverUpdateDataByCalendarEventId,
} from "@/components/src/server/admin";
import { updateCalendarEvent } from "@/components/src/server/calendars";
import {
  logServerBookingChange,
  serverGetDataByCalendarEventId,
} from "@/lib/firebase/server/adminDb";

const mockServerGetDataByCalendarEventId = vi.mocked(
  serverGetDataByCalendarEventId,
);
const mockServerUpdateDataByCalendarEventId = vi.mocked(
  serverUpdateDataByCalendarEventId,
);
const mockServerBookingContents = vi.mocked(serverBookingContents);
const mockUpdateCalendarEvent = vi.mocked(updateCalendarEvent);
const mockLogServerBookingChange = vi.mocked(logServerBookingChange);
const mockServerSendBookingDetailEmail = vi.mocked(
  serverSendBookingDetailEmail,
);

const createRequest = (body: any) => ({
  json: async () => body,
});

describe("POST /api/checkout-processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-123",
      requestNumber: 12345,
      email: "guest@nyu.edu",
    } as any);
    mockServerUpdateDataByCalendarEventId.mockResolvedValue(undefined);
    mockServerBookingContents.mockResolvedValue({} as any);
    mockUpdateCalendarEvent.mockResolvedValue(undefined);
    mockLogServerBookingChange.mockResolvedValue(undefined);
    mockServerSendBookingDetailEmail.mockResolvedValue(undefined);
  });

  it("successfully processes checkout with all operations", async () => {
    const requestBody = {
      calendarEventId: "event-123",
      email: "admin@nyu.edu",
      tenant: "media-commons",
    };

    const response = await POST(createRequest(requestBody) as any);
    const data = await response.json();

    expect(mockServerGetDataByCalendarEventId).toHaveBeenCalledWith(
      "BOOKING",
      "event-123",
      "media-commons",
    );
    expect(mockServerUpdateDataByCalendarEventId).toHaveBeenCalledWith(
      "BOOKING",
      "event-123",
      expect.objectContaining({
        checkedOutBy: "admin@nyu.edu",
      }),
      "media-commons",
    );
    expect(mockUpdateCalendarEvent).toHaveBeenCalledWith(
      "event-123",
      { statusPrefix: BookingStatusLabel.CHECKED_OUT },
      expect.anything(),
      "media-commons",
    );
    expect(mockLogServerBookingChange).toHaveBeenCalledWith({
      bookingId: "booking-123",
      calendarEventId: "event-123",
      status: BookingStatusLabel.CHECKED_OUT,
      changedBy: "admin@nyu.edu",
      requestNumber: 12345,
      tenant: "media-commons",
    });
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("sends checkout email to guest", async () => {
    const requestBody = {
      calendarEventId: "event-123",
      email: "admin@nyu.edu",
      tenant: "media-commons",
    };

    await POST(createRequest(requestBody) as any);

    expect(mockServerSendBookingDetailEmail).toHaveBeenCalledWith({
      calendarEventId: "event-123",
      targetEmail: "guest@nyu.edu",
      headerMessage: expect.stringContaining("checked out"),
      status: BookingStatusLabel.CHECKED_OUT,
      tenant: "media-commons",
    });
  });

  it("returns 400 when calendarEventId is missing", async () => {
    const requestBody = {
      email: "admin@nyu.edu",
      tenant: "media-commons",
    };

    const response = await POST(createRequest(requestBody) as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing required fields");
  });

  it("returns 400 when email is missing", async () => {
    const requestBody = {
      calendarEventId: "event-123",
      tenant: "media-commons",
    };

    const response = await POST(createRequest(requestBody) as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing required fields");
  });

  it("returns 400 when tenant is missing", async () => {
    const requestBody = {
      calendarEventId: "event-123",
      email: "admin@nyu.edu",
    };

    const response = await POST(createRequest(requestBody) as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing required fields");
  });

  it("returns 500 when booking is not found", async () => {
    mockServerGetDataByCalendarEventId.mockResolvedValue(null);

    const requestBody = {
      calendarEventId: "event-123",
      email: "admin@nyu.edu",
      tenant: "media-commons",
    };

    const response = await POST(createRequest(requestBody) as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Booking not found");
  });

  it("continues processing even if email sending fails", async () => {
    mockServerSendBookingDetailEmail.mockRejectedValue(
      new Error("Email service down"),
    );

    const requestBody = {
      calendarEventId: "event-123",
      email: "admin@nyu.edu",
      tenant: "media-commons",
    };

    const response = await POST(createRequest(requestBody) as any);
    const data = await response.json();

    expect(mockServerUpdateDataByCalendarEventId).toHaveBeenCalled();
    expect(mockLogServerBookingChange).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("continues processing even if calendar update fails", async () => {
    mockUpdateCalendarEvent.mockRejectedValue(
      new Error("Calendar API error"),
    );

    const requestBody = {
      calendarEventId: "event-123",
      email: "admin@nyu.edu",
      tenant: "media-commons",
    };

    const response = await POST(createRequest(requestBody) as any);
    const data = await response.json();

    expect(mockServerUpdateDataByCalendarEventId).toHaveBeenCalled();
    expect(mockLogServerBookingChange).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("returns 500 when database update fails", async () => {
    mockServerUpdateDataByCalendarEventId.mockRejectedValue(
      new Error("Database error"),
    );

    const requestBody = {
      calendarEventId: "event-123",
      email: "admin@nyu.edu",
      tenant: "media-commons",
    };

    const response = await POST(createRequest(requestBody) as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Database error");
  });
});
