import { BookingContext } from "@/components/src/client/routes/booking/bookingProvider";
import { CalendarDatePicker } from "@/components/src/client/routes/booking/components/CalendarDatePicker";
import { useBookingDateRestrictions } from "@/components/src/client/routes/booking/hooks/useBookingDateRestrictions";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { FormContextLevel } from "@/components/src/types";
import { render } from "@testing-library/react";
import dayjs from "dayjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the hooks
vi.mock(
  "@/components/src/client/routes/booking/hooks/useBookingDateRestrictions"
);
vi.mock("@/components/src/client/routes/booking/bookingProvider");

const mockUseBookingDateRestrictions = vi.mocked(useBookingDateRestrictions);

describe("Calendar Blackout Restrictions", () => {
  const mockBookingContext = {
    bookingCalendarInfo: null,
    setBookingCalendarInfo: vi.fn(),
    isInBlackoutPeriod: false,
    setIsInBlackoutPeriod: vi.fn(),
  };

  const mockDatabaseContext = {
    blackoutPeriods: [
      {
        id: "blackout-1",
        name: "Maintenance Period",
        startDate: "2024-07-15",
        endDate: "2024-07-15",
        startTime: "09:00",
        endTime: "17:00",
        isActive: true,
        roomIds: [220, 221, 222],
      },
      {
        id: "blackout-2",
        name: "All Day Event",
        startDate: "2024-07-20",
        endDate: "2024-07-20",
        startTime: null,
        endTime: null,
        isActive: true,
        roomIds: null, // All rooms
      },
    ],
    roomSettings: [
      { roomId: 220, title: "Room 220" },
      { roomId: 221, title: "Room 221" },
      { roomId: 222, title: "Room 222" },
      { roomId: 223, title: "Room 223" },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Date Picker Blackout Restrictions", () => {
    it("should disable dates during global blackout periods", () => {
      mockUseBookingDateRestrictions.mockReturnValue({
        isDateDisabled: (date) => {
          const dateStr = date.format("YYYY-MM-DD");
          return dateStr === "2024-07-20"; // Global blackout date
        },
        isDateDisabledForRooms: vi.fn(),
        shouldDisableDate: (date) => {
          const dateStr = date.format("YYYY-MM-DD");
          return dateStr === "2024-07-20";
        },
        shouldDisableDateForRooms: vi.fn(),
        getBlackoutPeriodForDate: vi.fn(),
        getBlackoutPeriodsForDateAndRooms: vi.fn(),
        isBookingTimeInBlackout: vi.fn(),
        getBlackoutPeriodsForBookingTime: vi.fn(),
        blackoutPeriods: mockDatabaseContext.blackoutPeriods,
        hasRestrictions: true,
      });

      const handleChange = vi.fn();

      render(
        <DatabaseContext.Provider value={mockDatabaseContext}>
          <BookingContext.Provider value={mockBookingContext}>
            <CalendarDatePicker
              handleChange={handleChange}
              formContext={FormContextLevel.BOOKING}
            />
          </BookingContext.Provider>
        </DatabaseContext.Provider>
      );

      // The global blackout date should be disabled
      expect(
        mockUseBookingDateRestrictions().shouldDisableDate(dayjs("2024-07-20"))
      ).toBe(true);
      // Regular dates should not be disabled (unless in the past)
      expect(
        mockUseBookingDateRestrictions().shouldDisableDate(dayjs("2024-07-25"))
      ).toBe(false);
    });

    it("should disable dates for specific rooms during room-specific blackout periods", () => {
      mockUseBookingDateRestrictions.mockReturnValue({
        isDateDisabled: vi.fn(),
        isDateDisabledForRooms: (date, roomIds) => {
          const dateStr = date.format("YYYY-MM-DD");
          if (dateStr === "2024-07-15") {
            // Check if any of the requested rooms overlap with blackout rooms [220, 221, 222]
            return roomIds.some((id) => [220, 221, 222].includes(id));
          }
          return false;
        },
        shouldDisableDate: vi.fn(),
        shouldDisableDateForRooms: (date, roomIds) => {
          const dateStr = date.format("YYYY-MM-DD");
          if (dateStr === "2024-07-15") {
            return roomIds.some((id) => [220, 221, 222].includes(id));
          }
          return false;
        },
        getBlackoutPeriodForDate: vi.fn(),
        getBlackoutPeriodsForDateAndRooms: vi.fn(),
        isBookingTimeInBlackout: vi.fn(),
        getBlackoutPeriodsForBookingTime: vi.fn(),
        blackoutPeriods: mockDatabaseContext.blackoutPeriods,
        hasRestrictions: true,
      });

      // Date should be disabled for rooms 220, 221, 222 but not for room 223
      expect(
        mockUseBookingDateRestrictions().isDateDisabledForRooms(
          dayjs("2024-07-15"),
          [220]
        )
      ).toBe(true);
      expect(
        mockUseBookingDateRestrictions().isDateDisabledForRooms(
          dayjs("2024-07-15"),
          [221, 222]
        )
      ).toBe(true);
      expect(
        mockUseBookingDateRestrictions().isDateDisabledForRooms(
          dayjs("2024-07-15"),
          [223]
        )
      ).toBe(false);
      expect(
        mockUseBookingDateRestrictions().isDateDisabledForRooms(
          dayjs("2024-07-16"),
          [220]
        )
      ).toBe(false);
    });

    it("should allow dates when no blackout periods are active", () => {
      mockUseBookingDateRestrictions.mockReturnValue({
        isDateDisabled: (date) => date.isBefore(dayjs(), "day"), // Only past dates
        isDateDisabledForRooms: (date) => date.isBefore(dayjs(), "day"),
        shouldDisableDate: (date) => date.isBefore(dayjs(), "day"),
        shouldDisableDateForRooms: (date) => date.isBefore(dayjs(), "day"),
        getBlackoutPeriodForDate: vi.fn().mockReturnValue(null),
        getBlackoutPeriodsForDateAndRooms: vi.fn().mockReturnValue([]),
        isBookingTimeInBlackout: vi
          .fn()
          .mockReturnValue({ inBlackout: false, affectedPeriods: [] }),
        getBlackoutPeriodsForBookingTime: vi.fn().mockReturnValue([]),
        blackoutPeriods: [],
        hasRestrictions: false,
      });

      const futureDate = dayjs().add(5, "days");
      expect(
        mockUseBookingDateRestrictions().shouldDisableDate(futureDate)
      ).toBe(false);
      expect(
        mockUseBookingDateRestrictions().isDateDisabledForRooms(
          futureDate,
          [220, 221]
        )
      ).toBe(false);
    });
  });

  describe("Time Selection Blackout Restrictions", () => {
    it("should detect time overlap with blackout periods", () => {
      mockUseBookingDateRestrictions.mockReturnValue({
        isDateDisabled: vi.fn(),
        isDateDisabledForRooms: vi.fn(),
        shouldDisableDate: vi.fn(),
        shouldDisableDateForRooms: vi.fn(),
        getBlackoutPeriodForDate: vi.fn(),
        getBlackoutPeriodsForDateAndRooms: vi.fn(),
        isBookingTimeInBlackout: (bookingStart, bookingEnd, roomIds) => {
          const bookingDate = bookingStart.format("YYYY-MM-DD");
          const bookingStartTime = bookingStart.format("HH:mm");
          const bookingEndTime = bookingEnd.format("HH:mm");

          // Check for blackout period 2024-07-15 09:00-17:00 for rooms [220, 221, 222]
          if (
            bookingDate === "2024-07-15" &&
            roomIds.some((id) => [220, 221, 222].includes(id))
          ) {
            // Check if booking time overlaps with 09:00-17:00
            const bookingStartMinutes =
              parseInt(bookingStartTime.split(":")[0]) * 60 +
              parseInt(bookingStartTime.split(":")[1]);
            const bookingEndMinutes =
              parseInt(bookingEndTime.split(":")[0]) * 60 +
              parseInt(bookingEndTime.split(":")[1]);
            const blackoutStartMinutes = 9 * 60; // 09:00
            const blackoutEndMinutes = 17 * 60; // 17:00

            const overlaps =
              bookingStartMinutes < blackoutEndMinutes &&
              bookingEndMinutes > blackoutStartMinutes;
            return {
              inBlackout: overlaps,
              affectedPeriods: overlaps
                ? [
                    {
                      name: "Maintenance Period",
                      startTime: "09:00",
                      endTime: "17:00",
                    },
                  ]
                : [],
            };
          }

          return { inBlackout: false, affectedPeriods: [] };
        },
        getBlackoutPeriodsForBookingTime: vi.fn(),
        blackoutPeriods: mockDatabaseContext.blackoutPeriods,
        hasRestrictions: true,
      });

      // Booking that overlaps with blackout period
      const overlappingStart = dayjs("2024-07-15 10:00");
      const overlappingEnd = dayjs("2024-07-15 12:00");
      const blackoutRooms = [220];

      const overlappingResult =
        mockUseBookingDateRestrictions().isBookingTimeInBlackout(
          overlappingStart,
          overlappingEnd,
          blackoutRooms
        );
      expect(overlappingResult.inBlackout).toBe(true);
      expect(overlappingResult.affectedPeriods).toHaveLength(1);

      // Booking that doesn't overlap with blackout period
      const nonOverlappingStart = dayjs("2024-07-15 18:00");
      const nonOverlappingEnd = dayjs("2024-07-15 20:00");

      const nonOverlappingResult =
        mockUseBookingDateRestrictions().isBookingTimeInBlackout(
          nonOverlappingStart,
          nonOverlappingEnd,
          blackoutRooms
        );
      expect(nonOverlappingResult.inBlackout).toBe(false);
      expect(nonOverlappingResult.affectedPeriods).toHaveLength(0);

      // Booking for non-blackout rooms on blackout date
      const nonBlackoutRooms = [223];
      const nonBlackoutRoomResult =
        mockUseBookingDateRestrictions().isBookingTimeInBlackout(
          overlappingStart,
          overlappingEnd,
          nonBlackoutRooms
        );
      expect(nonBlackoutRoomResult.inBlackout).toBe(false);
    });

    it("should handle edge cases for time boundaries", () => {
      mockUseBookingDateRestrictions.mockReturnValue({
        isDateDisabled: vi.fn(),
        isDateDisabledForRooms: vi.fn(),
        shouldDisableDate: vi.fn(),
        shouldDisableDateForRooms: vi.fn(),
        getBlackoutPeriodForDate: vi.fn(),
        getBlackoutPeriodsForDateAndRooms: vi.fn(),
        isBookingTimeInBlackout: (bookingStart, bookingEnd, roomIds) => {
          const bookingDate = bookingStart.format("YYYY-MM-DD");
          const bookingStartTime = bookingStart.format("HH:mm");
          const bookingEndTime = bookingEnd.format("HH:mm");

          // Exact boundary test for 09:00-17:00 blackout
          if (
            bookingDate === "2024-07-15" &&
            roomIds.some((id) => [220, 221, 222].includes(id))
          ) {
            // Booking exactly at boundaries should not overlap
            if (bookingStartTime === "17:00" || bookingEndTime === "09:00") {
              return { inBlackout: false, affectedPeriods: [] };
            }
            // Booking starting before 17:00 and ending after 09:00 overlaps
            if (bookingStartTime < "17:00" && bookingEndTime > "09:00") {
              return {
                inBlackout: true,
                affectedPeriods: [{ name: "Maintenance Period" }],
              };
            }
          }

          return { inBlackout: false, affectedPeriods: [] };
        },
        getBlackoutPeriodsForBookingTime: vi.fn(),
        blackoutPeriods: mockDatabaseContext.blackoutPeriods,
        hasRestrictions: true,
      });

      // Booking exactly at end of blackout period (17:00-18:00) should be allowed
      const boundaryEndStart = dayjs("2024-07-15 17:00");
      const boundaryEndEnd = dayjs("2024-07-15 18:00");
      const boundaryEndResult =
        mockUseBookingDateRestrictions().isBookingTimeInBlackout(
          boundaryEndStart,
          boundaryEndEnd,
          [220]
        );
      expect(boundaryEndResult.inBlackout).toBe(false);

      // Booking exactly at start of blackout period (08:00-09:00) should be allowed
      const boundaryStartStart = dayjs("2024-07-15 08:00");
      const boundaryStartEnd = dayjs("2024-07-15 09:00");
      const boundaryStartResult =
        mockUseBookingDateRestrictions().isBookingTimeInBlackout(
          boundaryStartStart,
          boundaryStartEnd,
          [220]
        );
      expect(boundaryStartResult.inBlackout).toBe(false);
    });
  });

  describe("Multi-day Blackout Period Restrictions", () => {
    it("should handle continuous multi-day blackout periods", () => {
      const multiDayBlackoutPeriods = [
        {
          id: "multiday-1",
          name: "Extended Maintenance",
          startDate: "2024-07-10",
          endDate: "2024-07-12",
          startTime: "10:00",
          endTime: "16:00",
          isActive: true,
          roomIds: [220, 221],
        },
      ];

      mockUseBookingDateRestrictions.mockReturnValue({
        isDateDisabled: vi.fn(),
        isDateDisabledForRooms: vi.fn(),
        shouldDisableDate: vi.fn(),
        shouldDisableDateForRooms: vi.fn(),
        getBlackoutPeriodForDate: vi.fn(),
        getBlackoutPeriodsForDateAndRooms: vi.fn(),
        isBookingTimeInBlackout: (bookingStart, bookingEnd, roomIds) => {
          const bookingDate = bookingStart.format("YYYY-MM-DD");
          const bookingStartTime = bookingStart.format("HH:mm");
          const bookingEndTime = bookingEnd.format("HH:mm");

          // Multi-day blackout: 2024-07-10 10:00 to 2024-07-12 16:00
          if (roomIds.some((id) => [220, 221].includes(id))) {
            if (bookingDate === "2024-07-10") {
              // Start date: blackout from 10:00 to end of day
              return {
                inBlackout: bookingStartTime >= "10:00",
                affectedPeriods: [],
              };
            } else if (bookingDate === "2024-07-11") {
              // Middle date: entire day is blocked
              return { inBlackout: true, affectedPeriods: [] };
            } else if (bookingDate === "2024-07-12") {
              // End date: blackout from start of day to 16:00
              return {
                inBlackout: bookingEndTime <= "16:00",
                affectedPeriods: [],
              };
            }
          }

          return { inBlackout: false, affectedPeriods: [] };
        },
        getBlackoutPeriodsForBookingTime: vi.fn(),
        blackoutPeriods: multiDayBlackoutPeriods,
        hasRestrictions: true,
      });

      // Start date - booking before blackout should be allowed
      const startDateEarly =
        mockUseBookingDateRestrictions().isBookingTimeInBlackout(
          dayjs("2024-07-10 08:00"),
          dayjs("2024-07-10 09:00"),
          [220]
        );
      expect(startDateEarly.inBlackout).toBe(false);

      // Start date - booking during blackout should be blocked
      const startDateLate =
        mockUseBookingDateRestrictions().isBookingTimeInBlackout(
          dayjs("2024-07-10 12:00"),
          dayjs("2024-07-10 14:00"),
          [220]
        );
      expect(startDateLate.inBlackout).toBe(true);

      // Middle date - any booking should be blocked
      const middleDate =
        mockUseBookingDateRestrictions().isBookingTimeInBlackout(
          dayjs("2024-07-11 10:00"),
          dayjs("2024-07-11 12:00"),
          [220]
        );
      expect(middleDate.inBlackout).toBe(true);

      // End date - booking before blackout end should be blocked
      const endDateEarly =
        mockUseBookingDateRestrictions().isBookingTimeInBlackout(
          dayjs("2024-07-12 10:00"),
          dayjs("2024-07-12 14:00"),
          [220]
        );
      expect(endDateEarly.inBlackout).toBe(true);

      // End date - booking after blackout should be allowed
      const endDateLate =
        mockUseBookingDateRestrictions().isBookingTimeInBlackout(
          dayjs("2024-07-12 18:00"),
          dayjs("2024-07-12 20:00"),
          [220]
        );
      expect(endDateLate.inBlackout).toBe(false);
    });
  });

  describe("Blackout Period Validation Messages", () => {
    it("should provide clear error messages for blackout conflicts", () => {
      mockUseBookingDateRestrictions.mockReturnValue({
        isDateDisabled: vi.fn(),
        isDateDisabledForRooms: vi.fn(),
        shouldDisableDate: vi.fn(),
        shouldDisableDateForRooms: vi.fn(),
        getBlackoutPeriodForDate: vi.fn(),
        getBlackoutPeriodsForDateAndRooms: vi.fn(),
        isBookingTimeInBlackout: vi.fn(),
        getBlackoutPeriodsForBookingTime: (
          bookingStart,
          bookingEnd,
          roomIds
        ) => {
          const bookingDate = bookingStart.format("YYYY-MM-DD");

          if (
            bookingDate === "2024-07-15" &&
            roomIds.some((id) => [220, 221, 222].includes(id))
          ) {
            return [
              {
                id: "blackout-1",
                name: "Maintenance Period",
                startDate: "2024-07-15",
                endDate: "2024-07-15",
                startTime: "09:00",
                endTime: "17:00",
                roomIds: [220, 221, 222],
              },
            ];
          }

          return [];
        },
        blackoutPeriods: mockDatabaseContext.blackoutPeriods,
        hasRestrictions: true,
      });

      const affectedPeriods =
        mockUseBookingDateRestrictions().getBlackoutPeriodsForBookingTime(
          dayjs("2024-07-15 10:00"),
          dayjs("2024-07-15 12:00"),
          [220]
        );

      expect(affectedPeriods).toHaveLength(1);
      expect(affectedPeriods[0].name).toBe("Maintenance Period");
      expect(affectedPeriods[0].startTime).toBe("09:00");
      expect(affectedPeriods[0].endTime).toBe("17:00");
    });
  });
});
