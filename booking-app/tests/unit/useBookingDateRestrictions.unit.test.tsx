import { useBookingDateRestrictions } from "@/components/src/client/routes/booking/hooks/useBookingDateRestrictions";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { BlackoutPeriod } from "@/components/src/types";
import { renderHook } from "@testing-library/react";
import dayjs from "dayjs";
import { Timestamp } from "firebase/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dayjs plugins
vi.mock("dayjs", async () => {
  const actual = await vi.importActual("dayjs");
  return actual;
});

const mockBlackoutPeriods: BlackoutPeriod[] = [
  {
    id: "1",
    name: "Summer Break",
    startDate: Timestamp.fromDate(dayjs("2026-06-01").toDate()),
    endDate: Timestamp.fromDate(dayjs("2026-08-31").toDate()),
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  },
  {
    id: "2",
    name: "Winter Holidays",
    startDate: Timestamp.fromDate(dayjs("2026-12-20").toDate()),
    endDate: Timestamp.fromDate(dayjs("2026-01-05").toDate()),
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  },
  {
    id: "3",
    name: "Maintenance Period",
    startDate: Timestamp.fromDate(dayjs("2026-03-15").toDate()),
    endDate: Timestamp.fromDate(dayjs("2026-03-20").toDate()),
    isActive: false, // This period is inactive
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  },
  {
    id: "4",
    name: "Room 221 Maintenance",
    startDate: Timestamp.fromDate(dayjs("2026-04-01").toDate()),
    endDate: Timestamp.fromDate(dayjs("2026-04-07").toDate()),
    isActive: true,
    roomIds: [221], // Only applies to room 221
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  },
  {
    id: "5",
    name: "Audio Equipment Upgrade",
    startDate: Timestamp.fromDate(dayjs("2026-05-01").toDate()),
    endDate: Timestamp.fromDate(dayjs("2026-05-15").toDate()),
    isActive: true,
    roomIds: [230, 221], // Applies to rooms 230 and 221
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  },
];

const mockDatabaseContext = {
  policy: {
    maxBookingDuration: 120,
    maxBookingDurationExceptions: [],
    banRule: [],
    showFirstAndLastName: false,
    allowGroupBooking: true,
    requireGroupName: false,
    allowGabrielInteraction: false,
    enableConcurrentBooking: false,
    enableEquipment: true,
    enablePhoneNumber: false,
    enableReservationDuration: true,
    enableAttendeeCount: false,
    enableBookingDescriptions: false,
    includeSetupTakedownTimeInLimit: true,
    equipmentOpenTime: new Date(),
    equipmentCloseTime: new Date(),
  },
  liaisonUsers: [],
  PAUsers: [],
  adminUsers: [],
  checkedInUsers: [],
  roomSettings: [],
  safetyTrainedUsers: [],
  userEmail: "test@nyu.edu",
  blackoutPeriods: mockBlackoutPeriods,
};

describe("useBookingDateRestrictions Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should disable dates within active blackout periods", () => {
    const { result } = renderHook(() => useBookingDateRestrictions(), {
      wrapper: ({ children }) => (
        <DatabaseContext.Provider value={mockDatabaseContext as any}>
          {children}
        </DatabaseContext.Provider>
      ),
    });

    // Test dates within Summer Break (active period)
    const summerDate = dayjs("2026-07-15");
    expect(result.current.isDateDisabled(summerDate)).toBe(true);

    // Test dates within Winter Holidays (active period)
    const winterDate = dayjs("2026-12-25");
    expect(result.current.isDateDisabled(winterDate)).toBe(true);
  });

  it("should not disable dates within inactive blackout periods", () => {
    const { result } = renderHook(() => useBookingDateRestrictions(), {
      wrapper: ({ children }) => (
        <DatabaseContext.Provider value={mockDatabaseContext as any}>
          {children}
        </DatabaseContext.Provider>
      ),
    });

    // Test date within Maintenance Period (inactive period)
    const maintenanceDate = dayjs("2026-03-17");
    expect(result.current.isDateDisabled(maintenanceDate)).toBe(false);
  });

  it("should not disable dates outside blackout periods", () => {
    const { result } = renderHook(() => useBookingDateRestrictions(), {
      wrapper: ({ children }) => (
        <DatabaseContext.Provider value={mockDatabaseContext as any}>
          {children}
        </DatabaseContext.Provider>
      ),
    });

    const normalDate1 = dayjs("2026-04-15"); // Between maintenance and summer
    const normalDate2 = dayjs("2026-10-15"); // Between summer and winter
    const normalDate3 = dayjs("2027-02-15"); // After winter

    expect(result.current.isDateDisabled(normalDate1)).toBe(false);
    expect(result.current.isDateDisabled(normalDate2)).toBe(false);
    expect(result.current.isDateDisabled(normalDate3)).toBe(false);
  });

  it("should handle dates on blackout period boundaries correctly", () => {
    const { result } = renderHook(() => useBookingDateRestrictions(), {
      wrapper: ({ children }) => (
        <DatabaseContext.Provider value={mockDatabaseContext as any}>
          {children}
        </DatabaseContext.Provider>
      ),
    });

    // Test start and end dates of Summer Break
    const startDate = dayjs("2026-06-01");
    const endDate = dayjs("2026-08-31");
    expect(result.current.isDateDisabled(startDate)).toBe(true);
    expect(result.current.isDateDisabled(endDate)).toBe(true);

    // Test day before Summer Break
    const dayBefore = dayjs("2026-05-31");
    expect(result.current.isDateDisabled(dayBefore)).toBe(false);

    // Test day after Summer Break
    const dayAfter = dayjs("2026-09-01");
    expect(result.current.isDateDisabled(dayAfter)).toBe(false);
  });

  it("should work correctly with empty blackout periods", () => {
    const contextWithEmptyPeriods = {
      ...mockDatabaseContext,
      blackoutPeriods: [],
    };

    const { result } = renderHook(() => useBookingDateRestrictions(), {
      wrapper: ({ children }) => (
        <DatabaseContext.Provider value={contextWithEmptyPeriods as any}>
          {children}
        </DatabaseContext.Provider>
      ),
    });

    // Any future date should be allowed when no blackout periods exist
    const testDate = dayjs("2026-07-15");
    expect(result.current.isDateDisabled(testDate)).toBe(false);
  });

  it("should handle undefined blackout periods gracefully", () => {
    const contextWithUndefinedPeriods = {
      ...mockDatabaseContext,
      blackoutPeriods: undefined,
    };

    const { result } = renderHook(() => useBookingDateRestrictions(), {
      wrapper: ({ children }) => (
        <DatabaseContext.Provider value={contextWithUndefinedPeriods as any}>
          {children}
        </DatabaseContext.Provider>
      ),
    });

    // Should not throw error and should allow dates
    const testDate = dayjs("2026-07-15");
    expect(result.current.isDateDisabled(testDate)).toBe(false);
  });

  it("should correctly handle overlapping blackout periods", () => {
    const overlappingPeriods = [
      ...mockBlackoutPeriods,
      {
        id: "4",
        name: "Overlapping Period",
        startDate: Timestamp.fromDate(dayjs("2026-07-01").toDate()),
        endDate: Timestamp.fromDate(dayjs("2026-07-31").toDate()),
        isActive: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
    ];

    const contextWithOverlappingPeriods = {
      ...mockDatabaseContext,
      blackoutPeriods: overlappingPeriods,
    };

    const { result } = renderHook(() => useBookingDateRestrictions(), {
      wrapper: ({ children }) => (
        <DatabaseContext.Provider value={contextWithOverlappingPeriods as any}>
          {children}
        </DatabaseContext.Provider>
      ),
    });

    // Date that falls in both Summer Break and Overlapping Period
    const overlappingDate = dayjs("2026-07-15");
    expect(result.current.isDateDisabled(overlappingDate)).toBe(true);
  });

  it("should handle edge case with same start and end date", () => {
    const singleDayPeriods = [
      {
        id: "5",
        name: "Single Day Event",
        startDate: Timestamp.fromDate(dayjs("2026-06-15").toDate()),
        endDate: Timestamp.fromDate(dayjs("2026-06-15").toDate()),
        isActive: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
    ];

    const contextWithSingleDayPeriods = {
      ...mockDatabaseContext,
      blackoutPeriods: singleDayPeriods,
    };

    const { result } = renderHook(() => useBookingDateRestrictions(), {
      wrapper: ({ children }) => (
        <DatabaseContext.Provider value={contextWithSingleDayPeriods as any}>
          {children}
        </DatabaseContext.Provider>
      ),
    });

    // The exact date should be disabled
    const exactDate = dayjs("2026-06-15");
    expect(result.current.isDateDisabled(exactDate)).toBe(true);

    // Days before and after should not be disabled
    const dayBefore = dayjs("2026-06-14");
    const dayAfter = dayjs("2026-06-16");
    expect(result.current.isDateDisabled(dayBefore)).toBe(false);
    expect(result.current.isDateDisabled(dayAfter)).toBe(false);
  });

  it("should provide the correct blackout period for a date", () => {
    const { result } = renderHook(() => useBookingDateRestrictions(), {
      wrapper: ({ children }) => (
        <DatabaseContext.Provider value={mockDatabaseContext as any}>
          {children}
        </DatabaseContext.Provider>
      ),
    });

    // Test getting blackout period for a date within Summer Break
    const summerDate = dayjs("2026-07-15");
    const blackoutPeriod = result.current.getBlackoutPeriodForDate(summerDate);
    expect(blackoutPeriod?.name).toBe("Summer Break");

    // Test getting blackout period for a date outside any period
    const normalDate = dayjs("2026-04-15");
    const noBlackoutPeriod =
      result.current.getBlackoutPeriodForDate(normalDate);
    expect(noBlackoutPeriod).toBeUndefined();
  });

  describe("Room-Specific Blackout Periods", () => {
    it("should check blackout periods for specific rooms", () => {
      const { result } = renderHook(() => useBookingDateRestrictions(), {
        wrapper: ({ children }) => (
          <DatabaseContext.Provider value={mockDatabaseContext as any}>
            {children}
          </DatabaseContext.Provider>
        ),
      });

      // Test room 221 during its maintenance period
      const room221MaintenanceDate = dayjs("2026-04-03");
      expect(
        result.current.isDateDisabledForRooms(room221MaintenanceDate, [221])
      ).toBe(true);
      expect(
        result.current.isDateDisabledForRooms(room221MaintenanceDate, [222])
      ).toBe(false);
      expect(
        result.current.isDateDisabledForRooms(
          room221MaintenanceDate,
          [221, 222]
        )
      ).toBe(true);
    });

    it("should handle multiple rooms in blackout periods", () => {
      const { result } = renderHook(() => useBookingDateRestrictions(), {
        wrapper: ({ children }) => (
          <DatabaseContext.Provider value={mockDatabaseContext as any}>
            {children}
          </DatabaseContext.Provider>
        ),
      });

      // Test during Audio Equipment Upgrade (affects rooms 230 and 221)
      const audioUpgradeDate = dayjs("2026-05-10");
      expect(
        result.current.isDateDisabledForRooms(audioUpgradeDate, [230])
      ).toBe(true);
      expect(
        result.current.isDateDisabledForRooms(audioUpgradeDate, [221])
      ).toBe(true);
      expect(
        result.current.isDateDisabledForRooms(audioUpgradeDate, [222])
      ).toBe(false);
      expect(
        result.current.isDateDisabledForRooms(audioUpgradeDate, [230, 221])
      ).toBe(true);
      expect(
        result.current.isDateDisabledForRooms(audioUpgradeDate, [222, 223])
      ).toBe(false);
    });

    it("should return blackout periods for specific rooms and dates", () => {
      const { result } = renderHook(() => useBookingDateRestrictions(), {
        wrapper: ({ children }) => (
          <DatabaseContext.Provider value={mockDatabaseContext as any}>
            {children}
          </DatabaseContext.Provider>
        ),
      });

      // Test getting blackout periods for room 221 during Audio Equipment Upgrade
      const audioUpgradeDate = dayjs("2026-05-10");
      const periodsForRoom221 =
        result.current.getBlackoutPeriodsForDateAndRooms(audioUpgradeDate, [
          221,
        ]);
      expect(periodsForRoom221).toHaveLength(1);
      expect(periodsForRoom221[0].name).toBe("Audio Equipment Upgrade");

      // Test getting blackout periods for room 222 (should be none during this period)
      const periodsForRoom222 =
        result.current.getBlackoutPeriodsForDateAndRooms(audioUpgradeDate, [
          222,
        ]);
      expect(periodsForRoom222).toHaveLength(0);

      // Test during global blackout period (Summer Break)
      const summerDate = dayjs("2026-07-15");
      const periodsForSummer = result.current.getBlackoutPeriodsForDateAndRooms(
        summerDate,
        [221, 222]
      );
      expect(periodsForSummer).toHaveLength(1);
      expect(periodsForSummer[0].name).toBe("Summer Break");
    });

    it("should handle global blackout periods correctly with room-specific checks", () => {
      const { result } = renderHook(() => useBookingDateRestrictions(), {
        wrapper: ({ children }) => (
          <DatabaseContext.Provider value={mockDatabaseContext as any}>
            {children}
          </DatabaseContext.Provider>
        ),
      });

      // Test during Summer Break (global blackout - affects all rooms)
      const summerDate = dayjs("2026-07-15");
      expect(result.current.isDateDisabledForRooms(summerDate, [221])).toBe(
        true
      );
      expect(result.current.isDateDisabledForRooms(summerDate, [222])).toBe(
        true
      );
      expect(result.current.isDateDisabledForRooms(summerDate, [230])).toBe(
        true
      );
      expect(
        result.current.isDateDisabledForRooms(summerDate, [221, 222, 230])
      ).toBe(true);
    });

    it("should handle empty room lists correctly", () => {
      const { result } = renderHook(() => useBookingDateRestrictions(), {
        wrapper: ({ children }) => (
          <DatabaseContext.Provider value={mockDatabaseContext as any}>
            {children}
          </DatabaseContext.Provider>
        ),
      });

      // Test with empty room list during room-specific blackout
      const room221MaintenanceDate = dayjs("2026-04-03");
      expect(
        result.current.isDateDisabledForRooms(room221MaintenanceDate, [])
      ).toBe(false);

      // Test with empty room list during global blackout
      const summerDate = dayjs("2026-07-15");
      expect(result.current.isDateDisabledForRooms(summerDate, [])).toBe(true);
    });

    it("should handle overlapping room-specific and global blackout periods", () => {
      const overlappingBlackoutPeriods = [
        ...mockBlackoutPeriods,
        {
          id: "6",
          name: "Room 221 Summer Maintenance",
          startDate: Timestamp.fromDate(dayjs("2026-07-01").toDate()),
          endDate: Timestamp.fromDate(dayjs("2026-07-31").toDate()),
          isActive: true,
          roomIds: [221],
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
      ];

      const contextWithOverlappingPeriods = {
        ...mockDatabaseContext,
        blackoutPeriods: overlappingBlackoutPeriods,
      };

      const { result } = renderHook(() => useBookingDateRestrictions(), {
        wrapper: ({ children }) => (
          <DatabaseContext.Provider
            value={contextWithOverlappingPeriods as any}
          >
            {children}
          </DatabaseContext.Provider>
        ),
      });

      // Test during overlap (both Summer Break and Room 221 Summer Maintenance)
      const overlapDate = dayjs("2026-07-15");
      const periodsForRoom221 =
        result.current.getBlackoutPeriodsForDateAndRooms(overlapDate, [221]);
      expect(periodsForRoom221).toHaveLength(2);
      const periodNames = periodsForRoom221.map((p) => p.name);
      expect(periodNames).toContain("Summer Break");
      expect(periodNames).toContain("Room 221 Summer Maintenance");
    });
  });
});
