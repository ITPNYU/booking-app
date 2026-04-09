import { describe, expect, it, beforeEach, vi } from "vitest";

import { logAutomaticCancellationTransition } from "@/lib/stateMachines/logAutomaticCancellationTransition";

const mockLogServerBookingChange = vi.fn();
const mockServerGetDataByCalendarEventId = vi.fn();

vi.mock("@/lib/firebase/server/adminDb", () => ({
  logServerBookingChange: mockLogServerBookingChange,
  serverGetDataByCalendarEventId: mockServerGetDataByCalendarEventId,
}));

describe("logAutomaticCancellationTransition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-123",
      requestNumber: 77,
    });
  });

  it("returns early when automationReason is missing", async () => {
    await logAutomaticCancellationTransition({
      calendarEventId: "evt-1",
      tenant: "itp",
    });

    expect(mockServerGetDataByCalendarEventId).not.toHaveBeenCalled();
    expect(mockLogServerBookingChange).not.toHaveBeenCalled();
  });

  it("returns early when calendarEventId is missing", async () => {
    await logAutomaticCancellationTransition({
      automationReason: "no-show",
      tenant: "mc",
    });

    expect(mockServerGetDataByCalendarEventId).not.toHaveBeenCalled();
    expect(mockLogServerBookingChange).not.toHaveBeenCalled();
  });

  it("logs no-show automatic cancellation with System attribution", async () => {
    await logAutomaticCancellationTransition({
      automationReason: "no-show",
      calendarEventId: "evt-noshow",
      tenant: "itp",
    });

    expect(mockLogServerBookingChange).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "booking-123",
        calendarEventId: "evt-noshow",
        status: "CANCELED",
        changedBy: "System",
        requestNumber: 77,
        note: "Canceled due to no show",
        tenant: "itp",
      }),
    );
  });

  it("logs decline automatic cancellation with System attribution", async () => {
    await logAutomaticCancellationTransition({
      automationReason: "decline",
      calendarEventId: "evt-decline",
      tenant: "mc",
    });

    expect(mockLogServerBookingChange).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "booking-123",
        calendarEventId: "evt-decline",
        status: "CANCELED",
        changedBy: "System",
        requestNumber: 77,
        note: "Canceled due to decline",
        tenant: "mc",
      }),
    );
  });
});