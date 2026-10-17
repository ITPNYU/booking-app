import { BookingContext } from "@/components/src/client/routes/booking/bookingProvider";
import useHandleStartBooking from "@/components/src/client/routes/booking/hooks/useHandleStartBooking";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { act, renderHook } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const renderStartBooking = () => {
  const context = {
    reloadExistingCalendarEvents: vi.fn(),
    setHasShownMocapModal: vi.fn(),
    setDepartment: vi.fn(),
    setRole: vi.fn(),
    setSelectedRooms: vi.fn(),
    setBookingCalendarInfo: vi.fn(),
    setFormData: vi.fn(),
    setIsDetailsValid: vi.fn(),
    resetServiceRuleMemory: vi.fn(),
    setCheckedAgreements: vi.fn(),
    setAnnexByRoom: vi.fn(),
    setServiceDecisions: vi.fn(),
    setViewDate: vi.fn(),
  } as any;
  const database = { reloadSafetyTrainedUsers: vi.fn() } as any;

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <DatabaseContext.Provider value={database}>
      <BookingContext.Provider value={context}>{children}</BookingContext.Provider>
    </DatabaseContext.Provider>
  );
  const { result } = renderHook(() => useHandleStartBooking(), { wrapper });
  return { handleStartBooking: result.current, context };
};

describe("useHandleStartBooking", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-16T15:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resets the calendar view month to today when a new booking starts", () => {
    // viewDate is provider state that survives client-side navigation, so a
    // month browsed in a previous booking must not leak into the next one.
    const { handleStartBooking, context } = renderStartBooking();

    act(() => handleStartBooking());

    expect(context.setViewDate).toHaveBeenCalledTimes(1);
    const viewDate = context.setViewDate.mock.calls[0][0] as Date;
    expect(viewDate.getTime()).toBe(new Date("2026-10-16T15:00:00.000Z").getTime());
  });

  it("clears the previous booking's selections", () => {
    const { handleStartBooking, context } = renderStartBooking();

    act(() => handleStartBooking());

    expect(context.setSelectedRooms).toHaveBeenCalledWith([]);
    expect(context.setBookingCalendarInfo).toHaveBeenCalledWith(undefined);
    expect(context.setFormData).toHaveBeenCalledWith(undefined);
    expect(context.setServiceDecisions).toHaveBeenCalledWith({});
    expect(context.reloadExistingCalendarEvents).toHaveBeenCalledTimes(1);
  });
});
