import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/server/adminDb", () => ({
  getBookingLogs: vi.fn(),
  logServerBookingChange: vi.fn(),
}));

import { GET, POST } from "@/app/api/booking-logs/route";
import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { BookingStatusLabel } from "@/components/src/types";
import {
  getBookingLogs,
  logServerBookingChange,
} from "@/lib/firebase/server/adminDb";

const mockGetBookingLogs = vi.mocked(getBookingLogs);
const mockLogServerBookingChange = vi.mocked(logServerBookingChange);

const createGetRequest = (requestNumber: string) => ({
  url: `http://localhost/api/booking-logs?requestNumber=${requestNumber}`,
});

const createPostRequest = (
  body: any,
  headers: Record<string, string> = {},
) => ({
  json: async () => body,
  headers: new Headers(headers),
});

describe("GET /api/booking-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns booking logs for valid request number", async () => {
    const mockLogs = [
      {
        status: BookingStatusLabel.REQUESTED,
        changedBy: "user@nyu.edu",
        changedAt: { toDate: () => new Date("2024-01-01") },
      },
      {
        status: BookingStatusLabel.APPROVED,
        changedBy: "admin@nyu.edu",
        changedAt: { toDate: () => new Date("2024-01-02") },
      },
    ];
    mockGetBookingLogs.mockResolvedValue(mockLogs as any);

    const response = await GET(createGetRequest("12345") as any);
    const data = await response.json();

    expect(mockGetBookingLogs).toHaveBeenCalledWith(12345);
    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(data[0].status).toBe(BookingStatusLabel.REQUESTED);
    expect(data[0].changedBy).toBe("user@nyu.edu");
    expect(data[1].status).toBe(BookingStatusLabel.APPROVED);
    expect(data[1].changedBy).toBe("admin@nyu.edu");
  });

  it("returns 400 when request number is missing", async () => {
    const response = await GET(createGetRequest("") as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("requestNumber parameter is required");
    expect(mockGetBookingLogs).not.toHaveBeenCalled();
  });

  it("returns 500 when database query fails", async () => {
    mockGetBookingLogs.mockRejectedValue(new Error("Database error"));

    const response = await GET(createGetRequest("12345") as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch booking logs");
  });
});

describe("POST /api/booking-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates booking log with all required fields", async () => {
    mockLogServerBookingChange.mockResolvedValue(undefined);

    const requestBody = {
      bookingId: "booking-123",
      calendarEventId: "event-123",
      status: BookingStatusLabel.APPROVED,
      changedBy: "admin@nyu.edu",
      requestNumber: 12345,
      note: "Test note",
    };

    const response = await POST(createPostRequest(requestBody) as any);
    const data = await response.json();

    expect(mockLogServerBookingChange).toHaveBeenCalledWith({
      bookingId: "booking-123",
      calendarEventId: "event-123",
      status: BookingStatusLabel.APPROVED,
      changedBy: "admin@nyu.edu",
      requestNumber: 12345,
      note: "Test note",
      tenant: DEFAULT_TENANT,
    });
    expect(response.status).toBe(200);
    expect(data.message).toBe("Booking log created successfully");
  });

  it("creates booking log with custom tenant from header", async () => {
    mockLogServerBookingChange.mockResolvedValue(undefined);

    const requestBody = {
      bookingId: "booking-123",
      calendarEventId: "event-123",
      status: BookingStatusLabel.DECLINED,
      changedBy: "admin@nyu.edu",
      requestNumber: 12345,
      note: null,
    };

    const response = await POST(
      createPostRequest(requestBody, { "x-tenant": "tenant-media" }) as any,
    );

    expect(mockLogServerBookingChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant: "tenant-media",
      }),
    );
    expect(response.status).toBe(200);
  });

  it("returns 400 when required fields are missing", async () => {
    const requestBody = {
      bookingId: "booking-123",
      // Missing status, changedBy, requestNumber
    };

    const response = await POST(createPostRequest(requestBody) as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing required fields");
    expect(mockLogServerBookingChange).not.toHaveBeenCalled();
  });

  it("returns 500 when database operation fails", async () => {
    mockLogServerBookingChange.mockRejectedValue(new Error("Database error"));

    const requestBody = {
      bookingId: "booking-123",
      calendarEventId: "event-123",
      status: BookingStatusLabel.APPROVED,
      changedBy: "admin@nyu.edu",
      requestNumber: 12345,
      note: null,
    };

    const response = await POST(createPostRequest(requestBody) as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to create booking log");
  });
});
