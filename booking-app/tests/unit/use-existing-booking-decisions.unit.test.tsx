import { BookingContext } from "@/components/src/client/routes/booking/bookingProvider";
import useExistingBooking from "@/components/src/client/routes/admin/hooks/useExistingBooking";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

const timestamp = (iso: string) => ({ toDate: () => new Date(iso) });

const booking = (overrides: Record<string, unknown> = {}) => ({
  calendarEventId: "evt1",
  department: "ITP",
  role: "Faculty",
  roomId: "202",
  startDate: timestamp("2026-05-05T10:00:00.000Z"),
  endDate: timestamp("2026-05-05T11:00:00.000Z"),
  title: "Demo",
  staffingServices: "audio_tech",
  catering: "yes",
  ...overrides,
});

const loadWith = (saved: Record<string, unknown>) => {
  const setServiceDecisions = vi.fn();
  const setFormData = vi.fn();
  const context = {
    setDepartment: vi.fn(),
    setRole: vi.fn(),
    setSelectedRooms: vi.fn(),
    setBookingCalendarInfo: vi.fn(),
    setFormData,
    setIsDetailsValid: vi.fn(),
    resetServiceRuleMemory: vi.fn(),
    setAnnexByRoom: vi.fn(),
    setServiceDecisions,
  } as any;
  const database = {
    allBookings: [saved],
    roomSettings: [{ roomId: "202", name: "Lecture Hall" }],
  } as any;
  const { result } = renderHook(() => useExistingBooking(), {
    wrapper: ({ children }) => (
      <DatabaseContext.Provider value={database}>
        <BookingContext.Provider value={context}>
          {children}
        </BookingContext.Provider>
      </DatabaseContext.Provider>
    ),
  });
  result.current("evt1");
  return { setServiceDecisions, setFormData };
};

describe("useExistingBooking service decisions", () => {
  it("carries the saved booking's decisions beside the form answers, not in them", () => {
    const { setServiceDecisions, setFormData } = loadWith(
      booking({
        staffServiceApproved: true,
        cateringServiceApproved: false,
        cleaningServiceApproved: null,
      }),
    );

    expect(setServiceDecisions).toHaveBeenCalledWith({
      staff: true,
      catering: false,
    });
    const answers = setFormData.mock.calls[0][0];
    expect(answers).not.toHaveProperty("staffServiceApproved");
    expect(answers).not.toHaveProperty("cateringServiceApproved");
  });

  it("loads no decisions for a booking without approval flags", () => {
    const { setServiceDecisions } = loadWith(booking());

    expect(setServiceDecisions).toHaveBeenCalledWith({});
  });
});
