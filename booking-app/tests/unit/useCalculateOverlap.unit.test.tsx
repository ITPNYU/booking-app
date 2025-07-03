import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BookingContext } from "@/components/src/client/routes/booking/bookingProvider";
import useCalculateOverlap from "@/components/src/client/routes/booking/hooks/useCalculateOverlap";
import { usePathname } from "next/navigation";

// Mock next/navigation so we can control pathname dynamically in each test
vi.mock("next/navigation", () => {
  return {
    usePathname: vi.fn(),
  };
});

// Helper to update the mocked pathname easily
const setMockPathname = (path: string) => {
  (usePathname as unknown as vi.Mock).mockReturnValue(path);
};

type CalendarEvent = {
  id: string;
  start: string;
  end: string;
  resourceId: string | number;
};

describe("useCalculateOverlap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const bookingCalendarInfo = {
    start: new Date("2025-07-06T15:00:00-04:00"),
    end: new Date("2025-07-06T17:00:00-04:00"),
    startStr: "2025-07-06T15:00:00-04:00",
    endStr: "2025-07-06T17:00:00-04:00",
    allDay: false,
  } as any;

  const baseContext = {
    bookingCalendarInfo,
    selectedRooms: [{ roomId: 222 }],
    reloadExistingCalendarEvents: vi.fn(),
  } as any;

  const wrapper =
    (ctx: any) =>
    ({ children }) => (
      <BookingContext.Provider value={ctx}>{children}</BookingContext.Provider>
    );

  it("returns false when there is no overlap", () => {
    setMockPathname("/tenant/book/form");

    const context = {
      ...baseContext,
      existingCalendarEvents: [
        {
          id: "event-late",
          start: "2025-07-06T18:00:00-04:00",
          end: "2025-07-06T19:00:00-04:00",
          resourceId: "222",
        } as CalendarEvent,
      ],
    };

    const { result } = renderHook(() => useCalculateOverlap(), {
      wrapper: wrapper(context),
    });

    expect(result.current).toBe(false);
  });

  it("returns true when another event in the same room overlaps", () => {
    setMockPathname("/tenant/book/form");

    const context = {
      ...baseContext,
      existingCalendarEvents: [
        {
          id: "event-overlap",
          start: "2025-07-06T16:00:00-04:00", // overlaps 16:00–17:00
          end: "2025-07-06T17:30:00-04:00",
          resourceId: "222",
        } as CalendarEvent,
      ],
    };

    const { result } = renderHook(() => useCalculateOverlap(), {
      wrapper: wrapper(context),
    });

    expect(result.current).toBe(true);
  });

  it("ignores the current booking when editing (same ID)", () => {
    const calendarEventId = "event123";
    setMockPathname(`/tenant/edit/${calendarEventId}`);

    const context = {
      ...baseContext,
      existingCalendarEvents: [
        {
          id: `${calendarEventId}:222:2025-07-06T15:00:00-04:00`,
          start: "2025-07-06T15:00:00-04:00",
          end: "2025-07-06T17:00:00-04:00",
          resourceId: "222",
        } as CalendarEvent,
      ],
    };

    const { result } = renderHook(() => useCalculateOverlap(), {
      wrapper: wrapper(context),
    });

    expect(result.current).toBe(false);
  });

  it("ignores the current booking when editing via nested path (e.g. /edit/form/<id>)", () => {
    const calendarEventId = "event456";
    setMockPathname(`/tenant/edit/form/${calendarEventId}`);

    const context = {
      ...baseContext,
      existingCalendarEvents: [
        {
          id: calendarEventId,
          start: "2025-07-06T15:00:00-04:00",
          end: "2025-07-06T17:00:00-04:00",
          resourceId: "222",
        } as CalendarEvent,
      ],
    };

    const { result } = renderHook(() => useCalculateOverlap(), {
      wrapper: wrapper(context),
    });

    expect(result.current).toBe(false);
  });
});
