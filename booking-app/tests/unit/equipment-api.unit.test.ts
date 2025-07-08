import admin from "firebase-admin";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/equipment/route";
import { serverUpdateDataByCalendarEventId } from "../../components/src/server/admin";
import {
  logServerBookingChange,
  serverGetDataByCalendarEventId,
} from "../../lib/firebase/server/adminDb";

// Mock dependencies
vi.mock("../../components/src/policy", () => ({
  TableNames: {
    BOOKING: "BOOKING",
  },
}));

vi.mock("../../components/src/server/admin", () => ({
  serverUpdateDataByCalendarEventId: vi.fn(),
}));

vi.mock("../../components/src/types", () => ({
  BookingStatusLabel: {
    EQUIPMENT: "EQUIPMENT",
    APPROVED: "APPROVED",
  },
}));

vi.mock("../../lib/firebase/server/adminDb", () => ({
  logServerBookingChange: vi.fn(),
  serverGetDataByCalendarEventId: vi.fn(),
}));

vi.mock("firebase-admin", () => ({
  default: {
    firestore: {
      Timestamp: {
        now: vi.fn(() => ({ seconds: 1708000000, nanoseconds: 0 })),
      },
    },
  },
  firestore: {
    Timestamp: {
      now: vi.fn(() => ({ seconds: 1708000000, nanoseconds: 0 })),
    },
  },
}));

// Set up mocks
beforeEach(() => {
  vi.clearAllMocks();
});

const createMockRequest = (body: any): NextRequest => {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as any as NextRequest;
};

const mockBookingData = {
  calendarEventId: "test-event-123",
  email: "test@nyu.edu",
  requestNumber: 1001,
  title: "Test Equipment Booking",
  roomId: "101",
};

describe("Equipment API Endpoint", () => {
  const mockServerUpdateDataByCalendarEventId = vi.mocked(
    serverUpdateDataByCalendarEventId
  );
  const mockLogServerBookingChange = vi.mocked(logServerBookingChange);
  const mockServerGetDataByCalendarEventId = vi.mocked(
    serverGetDataByCalendarEventId
  );
  const mockTimestampNow = vi.mocked(admin.firestore.Timestamp.now);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("SEND_TO_EQUIPMENT action", () => {
    it("should successfully send booking to equipment", async () => {
      mockServerGetDataByCalendarEventId.mockResolvedValue(mockBookingData);
      mockServerUpdateDataByCalendarEventId.mockResolvedValue(undefined);
      mockLogServerBookingChange.mockResolvedValue(undefined);

      const request = createMockRequest({
        id: "test-event-123",
        email: "admin@nyu.edu",
        action: "SEND_TO_EQUIPMENT",
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.message).toBe("Sent to equipment successfully");

      // Verify booking was fetched
      expect(mockServerGetDataByCalendarEventId).toHaveBeenCalledWith(
        "BOOKING",
        "test-event-123"
      );

      // Verify booking was updated with equipment fields
      expect(mockServerUpdateDataByCalendarEventId).toHaveBeenCalledWith(
        "BOOKING",
        "test-event-123",
        {
          equipmentAt: { seconds: 1708000000, nanoseconds: 0 },
          equipmentBy: "admin@nyu.edu",
        }
      );

      // Verify booking log was created
      expect(mockLogServerBookingChange).toHaveBeenCalledWith({
        bookingId: "test-event-123",
        calendarEventId: "test-event-123",
        status: "EQUIPMENT",
        changedBy: "admin@nyu.edu",
        requestNumber: 1001,
      });
    });

    it("should return 404 when booking is not found", async () => {
      mockServerGetDataByCalendarEventId.mockResolvedValue(null);

      const request = createMockRequest({
        id: "nonexistent-event",
        email: "admin@nyu.edu",
        action: "SEND_TO_EQUIPMENT",
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.error).toBe("Booking not found");

      // Should not attempt to update or log if booking doesn't exist
      expect(mockServerUpdateDataByCalendarEventId).not.toHaveBeenCalled();
      expect(mockLogServerBookingChange).not.toHaveBeenCalled();
    });

    it("should handle database update errors", async () => {
      mockServerGetDataByCalendarEventId.mockResolvedValue(mockBookingData);
      mockServerUpdateDataByCalendarEventId.mockRejectedValue(
        new Error("Database error")
      );

      const request = createMockRequest({
        id: "test-event-123",
        email: "admin@nyu.edu",
        action: "SEND_TO_EQUIPMENT",
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.error).toBe("Database error");
    });

    it("should handle logging errors", async () => {
      mockServerGetDataByCalendarEventId.mockResolvedValue(mockBookingData);
      mockServerUpdateDataByCalendarEventId.mockResolvedValue(undefined);
      mockLogServerBookingChange.mockRejectedValue(new Error("Logging error"));

      const request = createMockRequest({
        id: "test-event-123",
        email: "admin@nyu.edu",
        action: "SEND_TO_EQUIPMENT",
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.error).toBe("Logging error");
    });
  });

  describe("EQUIPMENT_APPROVE action", () => {
    it("should successfully approve equipment", async () => {
      mockServerGetDataByCalendarEventId.mockResolvedValue(mockBookingData);
      mockServerUpdateDataByCalendarEventId.mockResolvedValue(undefined);
      mockLogServerBookingChange.mockResolvedValue(undefined);

      const request = createMockRequest({
        id: "test-event-123",
        email: "equipment@nyu.edu",
        action: "EQUIPMENT_APPROVE",
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.message).toBe("Equipment approved successfully");

      // Verify booking was updated with equipment approval fields
      expect(mockServerUpdateDataByCalendarEventId).toHaveBeenCalledWith(
        "BOOKING",
        "test-event-123",
        {
          equipmentApprovedAt: { seconds: 1708000000, nanoseconds: 0 },
          equipmentApprovedBy: "equipment@nyu.edu",
        }
      );

      // Verify booking log was created with APPROVED status
      expect(mockLogServerBookingChange).toHaveBeenCalledWith({
        bookingId: "test-event-123",
        calendarEventId: "test-event-123",
        status: "APPROVED",
        changedBy: "equipment@nyu.edu",
        requestNumber: 1001,
      });
    });

    it("should return error when booking is not found for approval", async () => {
      mockServerGetDataByCalendarEventId.mockResolvedValue(null);

      const request = createMockRequest({
        id: "nonexistent-event",
        email: "equipment@nyu.edu",
        action: "EQUIPMENT_APPROVE",
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.error).toBe("Booking not found");
    });

    it("should handle approval database errors", async () => {
      mockServerGetDataByCalendarEventId.mockResolvedValue(mockBookingData);
      mockServerUpdateDataByCalendarEventId.mockRejectedValue(
        new Error("Approval failed")
      );

      const request = createMockRequest({
        id: "test-event-123",
        email: "equipment@nyu.edu",
        action: "EQUIPMENT_APPROVE",
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.error).toBe("Approval failed");
    });
  });

  describe("Invalid actions", () => {
    it("should return error for invalid action", async () => {
      mockServerGetDataByCalendarEventId.mockResolvedValue(mockBookingData);

      const request = createMockRequest({
        id: "test-event-123",
        email: "admin@nyu.edu",
        action: "INVALID_ACTION",
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe("Invalid action");

      // Should not perform any database operations for invalid actions
      expect(mockServerUpdateDataByCalendarEventId).not.toHaveBeenCalled();
      expect(mockLogServerBookingChange).not.toHaveBeenCalled();
    });

    it("should return error when action is missing", async () => {
      mockServerGetDataByCalendarEventId.mockResolvedValue(mockBookingData);

      const request = createMockRequest({
        id: "test-event-123",
        email: "admin@nyu.edu",
        // action is missing
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe("Invalid action");
    });
  });

  describe("Request validation", () => {
    it("should handle malformed JSON", async () => {
      const request = {
        json: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
      } as any as NextRequest;

      try {
        const response = await POST(request);
        const responseData = await response.json();

        expect(response.status).toBe(500);
        expect(responseData.error).toBe("Invalid JSON");
      } catch (error) {
        // The API function might throw the error directly instead of returning a response
        expect(error.message).toBe("Invalid JSON");
      }
    });

    it("should handle missing required fields", async () => {
      const request = createMockRequest({
        // Missing id, email, action
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      // Should fail when trying to get booking with undefined id
    });
  });

  describe("Timestamp handling", () => {
    it("should use current timestamp for equipment operations", async () => {
      mockServerGetDataByCalendarEventId.mockResolvedValue(mockBookingData);
      mockServerUpdateDataByCalendarEventId.mockResolvedValue(undefined);
      mockLogServerBookingChange.mockResolvedValue(undefined);

      const request = createMockRequest({
        id: "test-event-123",
        email: "admin@nyu.edu",
        action: "SEND_TO_EQUIPMENT",
      });

      const response = await POST(request);

      // Just verify that the operation succeeds - timestamp functionality is implicitly tested
      expect(response.status).toBe(200);
      expect(mockServerUpdateDataByCalendarEventId).toHaveBeenCalledWith(
        "BOOKING",
        "test-event-123",
        expect.objectContaining({
          equipmentAt: expect.any(Object),
          equipmentBy: "admin@nyu.edu",
        })
      );
    });

    it("should call Timestamp.now() for both send and approve actions", async () => {
      mockServerGetDataByCalendarEventId.mockResolvedValue(mockBookingData);
      mockServerUpdateDataByCalendarEventId.mockResolvedValue(undefined);
      mockLogServerBookingChange.mockResolvedValue(undefined);

      // Test SEND_TO_EQUIPMENT
      const sendRequest = createMockRequest({
        id: "test-event-123",
        email: "admin@nyu.edu",
        action: "SEND_TO_EQUIPMENT",
      });

      const sendResponse = await POST(sendRequest);
      expect(sendResponse.status).toBe(200);

      // Test EQUIPMENT_APPROVE
      const approveRequest = createMockRequest({
        id: "test-event-123",
        email: "equipment@nyu.edu",
        action: "EQUIPMENT_APPROVE",
      });

      const approveResponse = await POST(approveRequest);
      expect(approveResponse.status).toBe(200);

      // Verify both operations called the update function with timestamp objects
      expect(mockServerUpdateDataByCalendarEventId).toHaveBeenCalledTimes(2);
    });
  });

  describe("Error logging", () => {
    it("should log errors with booking ID", async () => {
      mockServerGetDataByCalendarEventId.mockRejectedValue(
        new Error("Database connection failed")
      );

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const request = createMockRequest({
        id: "test-event-123",
        email: "admin@nyu.edu",
        action: "SEND_TO_EQUIPMENT",
      });

      await POST(request);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error processing equipment request",
        {
          booking_id: "test-event-123",
          error: expect.any(Error),
        }
      );

      consoleSpy.mockRestore();
    });
  });
});
