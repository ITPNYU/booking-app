import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/src/server/db", () => ({
  processCancelBooking: vi.fn(),
}));

vi.mock("@/components/src/server/calendars", () => ({
  deleteEvent: vi.fn(),
}));

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetDataByCalendarEventId: vi.fn(),
  serverGetDocumentById: vi.fn(),
}));

vi.mock("@/components/src/policy", () => ({
  TableNames: {
    BOOKING: "BOOKING",
    TENANT_SCHEMA: "TENANT_SCHEMA",
  },
}));

import { POST } from "@/app/api/cancel-processing/route";
import { deleteEvent } from "@/components/src/server/calendars";
import { processCancelBooking } from "@/components/src/server/db";
import {
  serverGetDataByCalendarEventId,
  serverGetDocumentById,
} from "@/lib/firebase/server/adminDb";

const mockProcessCancelBooking = vi.mocked(processCancelBooking);
const mockDeleteEvent = vi.mocked(deleteEvent);
const mockServerGetDataByCalendarEventId = vi.mocked(
  serverGetDataByCalendarEventId,
);
const mockServerGetDocumentById = vi.mocked(serverGetDocumentById);

const createRequest = (body: any) => ({
  json: async () => body,
});

describe("POST /api/cancel-processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully processes cancel booking with calendar deletion", async () => {
    mockProcessCancelBooking.mockResolvedValue(undefined);
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      roomId: "101",
    } as any);
    mockServerGetDocumentById.mockResolvedValue({
      resources: [
        { roomId: 101, calendarId: "calendar-101" },
      ],
    } as any);
    mockDeleteEvent.mockResolvedValue(undefined);

    const requestBody = {
      calendarEventId: "event-123",
      email: "admin@nyu.edu",
      netId: "admin123",
      tenant: "media-commons",
    };

    const response = await POST(createRequest(requestBody) as any);
    const data = await response.json();

    expect(mockProcessCancelBooking).toHaveBeenCalledWith(
      "event-123",
      "admin@nyu.edu",
      "admin123",
      "media-commons",
    );
    expect(mockDeleteEvent).toHaveBeenCalledWith(
      "calendar-101",
      "event-123",
      101,
    );
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("processes multiple room calendar deletions", async () => {
    mockProcessCancelBooking.mockResolvedValue(undefined);
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      roomId: "101, 102",
    } as any);
    mockServerGetDocumentById.mockResolvedValue({
      resources: [
        { roomId: 101, calendarId: "calendar-101" },
        { roomId: 102, calendarId: "calendar-102" },
      ],
    } as any);
    mockDeleteEvent.mockResolvedValue(undefined);

    const requestBody = {
      calendarEventId: "event-123",
      email: "admin@nyu.edu",
      netId: "admin123",
      tenant: "media-commons",
    };

    const response = await POST(createRequest(requestBody) as any);
    const data = await response.json();

    expect(mockDeleteEvent).toHaveBeenCalledTimes(2);
    expect(mockDeleteEvent).toHaveBeenCalledWith(
      "calendar-101",
      "event-123",
      101,
    );
    expect(mockDeleteEvent).toHaveBeenCalledWith(
      "calendar-102",
      "event-123",
      102,
    );
    expect(data.success).toBe(true);
  });

  it("continues processing even if calendar deletion fails", async () => {
    mockProcessCancelBooking.mockResolvedValue(undefined);
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      roomId: "101",
    } as any);
    mockServerGetDocumentById.mockResolvedValue({
      resources: [
        { roomId: 101, calendarId: "calendar-101" },
      ],
    } as any);
    mockDeleteEvent.mockRejectedValue(new Error("Calendar API error"));

    const requestBody = {
      calendarEventId: "event-123",
      email: "admin@nyu.edu",
      netId: "admin123",
      tenant: "media-commons",
    };

    const response = await POST(createRequest(requestBody) as any);
    const data = await response.json();

    expect(mockProcessCancelBooking).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("handles booking not found scenario", async () => {
    mockProcessCancelBooking.mockResolvedValue(undefined);
    mockServerGetDataByCalendarEventId.mockResolvedValue(null);

    const requestBody = {
      calendarEventId: "event-123",
      email: "admin@nyu.edu",
      netId: "admin123",
      tenant: "media-commons",
    };

    const response = await POST(createRequest(requestBody) as any);
    const data = await response.json();

    expect(mockProcessCancelBooking).toHaveBeenCalled();
    expect(mockDeleteEvent).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("handles missing schema scenario", async () => {
    mockProcessCancelBooking.mockResolvedValue(undefined);
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      roomId: "101",
    } as any);
    mockServerGetDocumentById.mockResolvedValue(null);

    const requestBody = {
      calendarEventId: "event-123",
      email: "admin@nyu.edu",
      netId: "admin123",
      tenant: "media-commons",
    };

    const response = await POST(createRequest(requestBody) as any);
    const data = await response.json();

    expect(mockDeleteEvent).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("returns 500 when cancel processing fails", async () => {
    mockProcessCancelBooking.mockRejectedValue(
      new Error("Cancel processing failed"),
    );

    const requestBody = {
      calendarEventId: "event-123",
      email: "admin@nyu.edu",
      netId: "admin123",
      tenant: "media-commons",
    };

    const response = await POST(createRequest(requestBody) as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Cancel processing failed");
  });
});
