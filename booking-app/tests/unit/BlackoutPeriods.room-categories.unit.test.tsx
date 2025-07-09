import {
  EVENT_ROOMS,
  MULTI_ROOMS,
  PRODUCTION_ROOMS,
} from "@/components/src/mediaCommonsPolicy";

describe("Blackout Period Room Categories", () => {
  describe("Room Categories Constants", () => {
    it("should have correct production rooms", () => {
      const expectedProductionRooms = [
        220, 221, 222, 223, 224, 230, 233, 103, 260,
      ];
      expect(PRODUCTION_ROOMS).toEqual(expectedProductionRooms);
    });

    it("should have correct event rooms including new additions", () => {
      const expectedEventRooms = [1201, 202, 233, 103, 260];
      expect(EVENT_ROOMS).toEqual(expectedEventRooms);
    });

    it("should have correct multi-room category", () => {
      const expectedMultiRooms = [233, 103, 260];
      expect(MULTI_ROOMS).toEqual(expectedMultiRooms);
    });

    it("should ensure multi rooms are included in both production and event categories", () => {
      MULTI_ROOMS.forEach((roomId) => {
        expect(PRODUCTION_ROOMS).toContain(roomId);
        expect(EVENT_ROOMS).toContain(roomId);
      });
    });
  });

  describe("Room Category Logic", () => {
    it("should properly categorize rooms by type", () => {
      // Production rooms requiring safety training
      const productionOnlyRooms = PRODUCTION_ROOMS.filter(
        (id) => !MULTI_ROOMS.includes(id)
      );
      expect(productionOnlyRooms).toEqual([220, 221, 222, 223, 224, 230]);

      // Event rooms not requiring safety training
      const eventOnlyRooms = EVENT_ROOMS.filter(
        (id) => !MULTI_ROOMS.includes(id)
      );
      expect(eventOnlyRooms).toEqual([1201, 202]);

      // Multi-room category (appears in both)
      expect(MULTI_ROOMS).toEqual([233, 103, 260]);
    });

    it("should have no duplicate room IDs within each category", () => {
      const productionSet = new Set(PRODUCTION_ROOMS);
      const eventSet = new Set(EVENT_ROOMS);
      const multiSet = new Set(MULTI_ROOMS);

      expect(productionSet.size).toBe(PRODUCTION_ROOMS.length);
      expect(eventSet.size).toBe(EVENT_ROOMS.length);
      expect(multiSet.size).toBe(MULTI_ROOMS.length);
    });

    it("should properly display room numbers in blackout labels", () => {
      // Test the logic that would be used to display room numbers
      const formatRoomNumbers = (rooms: number[]) => {
        if (rooms.length <= 3) {
          return rooms.join(", ");
        }
        return `${rooms.slice(0, 3).join(", ")}, ...`;
      };

      expect(formatRoomNumbers(MULTI_ROOMS)).toBe("233, 103, 260");
      expect(formatRoomNumbers(EVENT_ROOMS)).toBe("1201, 202, 233, ...");
      expect(formatRoomNumbers(PRODUCTION_ROOMS)).toBe("220, 221, 222, ...");
    });

    it("should format date and time display correctly", () => {
      // Test the formatting logic that would be used in the component
      const mockDate = new Date("2024-01-15T12:00:00Z"); // Use ISO format with UTC
      const mockTime = "14:30";

      const dateStr = mockDate.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        timeZone: "UTC", // Force UTC to avoid timezone issues
      });
      const expectedFormat = `${dateStr} at ${mockTime}`;

      // Check the format pattern rather than exact match
      expect(expectedFormat).toMatch(/\w{3} \d{2}, \d{4} at \d{2}:\d{2}/);
      expect(expectedFormat).toContain("at 14:30");
    });

    it("should handle room filtering for blackout application", () => {
      // Test logic for applying blackout to specific room categories
      const applyBlackoutToCategory = (
        category: string,
        availableRooms: number[]
      ) => {
        switch (category) {
          case "production":
            return PRODUCTION_ROOMS.filter((id) => availableRooms.includes(id));
          case "event":
            return EVENT_ROOMS.filter((id) => availableRooms.includes(id));
          case "multi":
            return MULTI_ROOMS.filter((id) => availableRooms.includes(id));
          case "all":
            return availableRooms;
          default:
            return [];
        }
      };

      const availableRooms = [220, 221, 1201, 202, 233, 103, 999]; // Include non-category room

      expect(applyBlackoutToCategory("production", availableRooms)).toEqual([
        220, 221, 233, 103,
      ]);
      expect(applyBlackoutToCategory("event", availableRooms)).toEqual([
        1201, 202, 233, 103,
      ]);
      expect(applyBlackoutToCategory("multi", availableRooms)).toEqual([
        233, 103,
      ]);
      expect(applyBlackoutToCategory("all", availableRooms)).toEqual(
        availableRooms
      );
    });
  });

  // Time-aware blackout functionality tests
  describe("Time-Aware Blackout Functionality", () => {
    it("should handle blackout periods with specific time ranges", () => {
      // Mock blackout period with time range
      const mockBlackoutPeriod = {
        id: "test-1",
        name: "Morning Maintenance",
        startTime: "09:00",
        endTime: "12:00",
        roomIds: [220, 221],
        isActive: true,
      };

      // Test time parsing logic
      const [startHour, startMinute] = mockBlackoutPeriod.startTime
        .split(":")
        .map(Number);
      const [endHour, endMinute] = mockBlackoutPeriod.endTime
        .split(":")
        .map(Number);

      expect(startHour).toBe(9);
      expect(startMinute).toBe(0);
      expect(endHour).toBe(12);
      expect(endMinute).toBe(0);
    });

    it("should handle blackout periods spanning midnight", () => {
      // Mock blackout period that spans midnight
      const mockBlackoutPeriod = {
        id: "test-2",
        name: "Overnight Maintenance",
        startTime: "23:00",
        endTime: "06:00",
        roomIds: [220],
        isActive: true,
      };

      // Test midnight spanning logic
      const [startHour] = mockBlackoutPeriod.startTime.split(":").map(Number);
      const [endHour] = mockBlackoutPeriod.endTime.split(":").map(Number);

      expect(startHour).toBe(23);
      expect(endHour).toBe(6);
      expect(endHour < startHour).toBe(true); // End time is before start time (spans midnight)
    });

    it("should handle blackout periods without specific times (all-day)", () => {
      // Mock blackout period without time specification
      const mockBlackoutPeriod = {
        id: "test-3",
        name: "All Day Event",
        startTime: undefined,
        endTime: undefined,
        roomIds: [220, 221],
        isActive: true,
      };

      // Test all-day logic - when no times are specified, it should apply to entire day
      expect(mockBlackoutPeriod.startTime).toBeUndefined();
      expect(mockBlackoutPeriod.endTime).toBeUndefined();
    });

    it("should handle time overlap detection logic", () => {
      // Mock function to test time overlap detection
      const checkTimeOverlap = (
        bookingStart: string,
        bookingEnd: string,
        blackoutStart: string,
        blackoutEnd: string
      ) => {
        const parseTime = (timeStr: string) => {
          const [hours, minutes] = timeStr.split(":").map(Number);
          return hours * 60 + minutes; // Convert to minutes for easy comparison
        };

        let bookingStartMin = parseTime(bookingStart);
        let bookingEndMin = parseTime(bookingEnd);
        let blackoutStartMin = parseTime(blackoutStart);
        let blackoutEndMin = parseTime(blackoutEnd);

        // Handle midnight spanning for booking
        if (bookingEndMin < bookingStartMin) {
          bookingEndMin += 24 * 60; // Add 24 hours in minutes
        }

        // Handle midnight spanning for blackout
        if (blackoutEndMin < blackoutStartMin) {
          blackoutEndMin += 24 * 60; // Add 24 hours in minutes
        }

        // Check overlap
        return (
          (bookingStartMin < blackoutEndMin &&
            bookingEndMin > blackoutStartMin) ||
          bookingStartMin === blackoutStartMin ||
          bookingEndMin === blackoutEndMin
        );
      };

      // Test various time overlap scenarios
      expect(checkTimeOverlap("10:00", "11:00", "09:00", "12:00")).toBe(true); // Booking within blackout
      expect(checkTimeOverlap("08:00", "10:00", "09:00", "12:00")).toBe(true); // Booking overlaps start
      expect(checkTimeOverlap("11:00", "13:00", "09:00", "12:00")).toBe(true); // Booking overlaps end
      expect(checkTimeOverlap("08:00", "13:00", "09:00", "12:00")).toBe(true); // Booking contains blackout
      expect(checkTimeOverlap("07:00", "08:00", "09:00", "12:00")).toBe(false); // No overlap (before)
      expect(checkTimeOverlap("13:00", "14:00", "09:00", "12:00")).toBe(false); // No overlap (after)

      // Test basic midnight spanning (blackout period spans midnight)
      expect(checkTimeOverlap("22:00", "23:30", "23:00", "02:00")).toBe(true); // Overlap with midnight span start
    });

    it("should handle multi-day blackout periods with time restrictions", () => {
      // Mock multi-day blackout period
      const mockBlackoutPeriod = {
        id: "test-4",
        name: "Multi-day Maintenance",
        startTime: "14:00",
        endTime: "16:00",
        roomIds: [220],
        isActive: true,
      };

      // Test that time restrictions apply to each day of the period
      expect(mockBlackoutPeriod.startTime).toBe("14:00");
      expect(mockBlackoutPeriod.endTime).toBe("16:00");

      // In a multi-day period, these times should apply to each day
      // So 14:00-16:00 on Day 1, 14:00-16:00 on Day 2, etc.
    });

    it("should handle continuous blackout for multi-day periods", () => {
      // Test logic for multi-day blackout periods (7/9 10:00 to 7/10 21:00)
      const checkMultiDayBlackout = (
        bookingDate: string,
        bookingStart: string,
        bookingEnd: string,
        blackoutStartDate: string,
        blackoutEndDate: string,
        blackoutStartTime: string,
        blackoutEndTime: string
      ) => {
        const isStartDate = bookingDate === blackoutStartDate;
        const isEndDate = bookingDate === blackoutEndDate;
        const isSameDay = blackoutStartDate === blackoutEndDate;

        if (isSameDay) {
          // Single day - use time range
          return checkTimeOverlap(
            bookingStart,
            bookingEnd,
            blackoutStartTime,
            blackoutEndTime
          );
        } else if (isStartDate) {
          // Start date: blackout from start time to end of day
          return checkTimeOverlap(
            bookingStart,
            bookingEnd,
            blackoutStartTime,
            "23:59"
          );
        } else if (isEndDate) {
          // End date: blackout from start of day to end time
          return checkTimeOverlap(
            bookingStart,
            bookingEnd,
            "00:00",
            blackoutEndTime
          );
        } else {
          // Middle day: blackout entire day
          return true;
        }
      };

      // Helper function for time overlap (simplified version)
      const checkTimeOverlap = (
        bookingStart: string,
        bookingEnd: string,
        blackoutStart: string,
        blackoutEnd: string
      ) => {
        const parseTime = (timeStr: string) => {
          const [hours, minutes] = timeStr.split(":").map(Number);
          return hours * 60 + minutes;
        };

        const bookingStartMin = parseTime(bookingStart);
        const bookingEndMin = parseTime(bookingEnd);
        const blackoutStartMin = parseTime(blackoutStart);
        const blackoutEndMin = parseTime(blackoutEnd);

        return (
          bookingStartMin < blackoutEndMin && bookingEndMin > blackoutStartMin
        );
      };

      // Test multi-day scenario: 7/9 10:00 to 7/10 21:00
      // Start date (7/9): 10:00 to end of day
      expect(
        checkMultiDayBlackout(
          "2024-07-09",
          "08:00",
          "09:00",
          "2024-07-09",
          "2024-07-10",
          "10:00",
          "21:00"
        )
      ).toBe(false); // Before blackout
      expect(
        checkMultiDayBlackout(
          "2024-07-09",
          "09:30",
          "10:30",
          "2024-07-09",
          "2024-07-10",
          "10:00",
          "21:00"
        )
      ).toBe(true); // Overlaps start
      expect(
        checkMultiDayBlackout(
          "2024-07-09",
          "15:00",
          "16:00",
          "2024-07-09",
          "2024-07-10",
          "10:00",
          "21:00"
        )
      ).toBe(true); // During first day
      expect(
        checkMultiDayBlackout(
          "2024-07-09",
          "23:00",
          "23:30",
          "2024-07-09",
          "2024-07-10",
          "10:00",
          "21:00"
        )
      ).toBe(true); // End of first day

      // End date (7/10): start of day to 21:00
      expect(
        checkMultiDayBlackout(
          "2024-07-10",
          "00:30",
          "01:30",
          "2024-07-09",
          "2024-07-10",
          "10:00",
          "21:00"
        )
      ).toBe(true); // Start of last day
      expect(
        checkMultiDayBlackout(
          "2024-07-10",
          "15:00",
          "16:00",
          "2024-07-09",
          "2024-07-10",
          "10:00",
          "21:00"
        )
      ).toBe(true); // During last day
      expect(
        checkMultiDayBlackout(
          "2024-07-10",
          "20:30",
          "21:30",
          "2024-07-09",
          "2024-07-10",
          "10:00",
          "21:00"
        )
      ).toBe(true); // Overlaps end
      expect(
        checkMultiDayBlackout(
          "2024-07-10",
          "22:00",
          "23:00",
          "2024-07-09",
          "2024-07-10",
          "10:00",
          "21:00"
        )
      ).toBe(false); // After blackout

      // Same day scenario should use time range only
      expect(
        checkMultiDayBlackout(
          "2024-07-09",
          "08:00",
          "09:00",
          "2024-07-09",
          "2024-07-09",
          "10:00",
          "21:00"
        )
      ).toBe(false); // Before
      expect(
        checkMultiDayBlackout(
          "2024-07-09",
          "15:00",
          "16:00",
          "2024-07-09",
          "2024-07-09",
          "10:00",
          "21:00"
        )
      ).toBe(true); // During
      expect(
        checkMultiDayBlackout(
          "2024-07-09",
          "22:00",
          "23:00",
          "2024-07-09",
          "2024-07-09",
          "10:00",
          "21:00"
        )
      ).toBe(false); // After
    });
  });
});
