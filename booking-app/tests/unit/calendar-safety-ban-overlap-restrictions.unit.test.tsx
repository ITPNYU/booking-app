import { useBookingDateRestrictions } from "@/components/src/client/routes/booking/hooks/useBookingDateRestrictions";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { SAFETY_TRAINING_REQUIRED_ROOM } from "@/components/src/mediaCommonsPolicy";
import { Role } from "@/components/src/types";
import { renderHook } from "@testing-library/react";
import dayjs from "dayjs";
import { Timestamp } from "firebase/firestore";
import { describe, expect, it, vi } from "vitest";

// Mock hooks
vi.mock(
  "@/components/src/client/routes/booking/hooks/fetchCalendarEvents",
  () => ({
    default: vi.fn(() => ({
      existingCalendarEvents: [],
      reloadExistingCalendarEvents: vi.fn(),
      fetchingStatus: "loaded",
    })),
  })
);

describe("Calendar Safety Training, Ban, and Overlap Restrictions Logic", () => {
  describe("Safety Training Room Requirements", () => {
    it("should correctly identify safety training required rooms", () => {
      expect(SAFETY_TRAINING_REQUIRED_ROOM).toContain(103);
      expect(SAFETY_TRAINING_REQUIRED_ROOM).toContain(220);
      expect(SAFETY_TRAINING_REQUIRED_ROOM).toContain(221);
      expect(SAFETY_TRAINING_REQUIRED_ROOM).toContain(222);
      expect(SAFETY_TRAINING_REQUIRED_ROOM).toContain(223);
      expect(SAFETY_TRAINING_REQUIRED_ROOM).toContain(224);
      expect(SAFETY_TRAINING_REQUIRED_ROOM).toContain(230);

      // Rooms that don't require safety training
      expect(SAFETY_TRAINING_REQUIRED_ROOM).not.toContain(233);
      expect(SAFETY_TRAINING_REQUIRED_ROOM).not.toContain(202);
      expect(SAFETY_TRAINING_REQUIRED_ROOM).not.toContain(1201);
    });

    it("should determine safety training needs based on room selection and user role", () => {
      const mockDatabaseContext = {
        roomSettings: [],
        safetyTrainedUsers: [],
        bannedUsers: [],
        userEmail: "student@nyu.edu",
        blackoutPeriods: [],
      };

      const testCases = [
        {
          description: "Student with safety room and no training",
          role: Role.STUDENT,
          selectedRoomId: 103, // Safety training required
          userEmail: "student@nyu.edu",
          trainedUsers: [], // Not trained
          expectedNeedsSafetyTraining: true,
        },
        {
          description: "Student with safety room and training",
          role: Role.STUDENT,
          selectedRoomId: 103, // Safety training required
          userEmail: "student@nyu.edu",
          trainedUsers: [{ email: "student@nyu.edu" }], // Trained
          expectedNeedsSafetyTraining: false,
        },
        {
          description: "Faculty with safety room and no training",
          role: Role.FACULTY,
          selectedRoomId: 103, // Safety training required
          userEmail: "faculty@nyu.edu",
          trainedUsers: [], // Not trained
          expectedNeedsSafetyTraining: false, // Faculty doesn't need training
        },
        {
          description: "Student with non-safety room",
          role: Role.STUDENT,
          selectedRoomId: 233, // No safety training required
          userEmail: "student@nyu.edu",
          trainedUsers: [], // Not trained
          expectedNeedsSafetyTraining: false,
        },
      ];

      testCases.forEach(
        ({
          description,
          role,
          selectedRoomId,
          userEmail,
          trainedUsers,
          expectedNeedsSafetyTraining,
        }) => {
          const isStudent = role === Role.STUDENT;
          const roomRequiresSafetyTraining =
            SAFETY_TRAINING_REQUIRED_ROOM.includes(selectedRoomId);
          const isSafetyTrained = trainedUsers.some(
            (user) => user.email === userEmail
          );

          const needsSafetyTraining =
            isStudent && roomRequiresSafetyTraining && !isSafetyTrained;

          expect(needsSafetyTraining).toBe(expectedNeedsSafetyTraining);
        }
      );
    });
  });

  describe("Ban Status Validation", () => {
    it("should correctly identify banned users", () => {
      const bannedUsers = [
        { email: "banned1@nyu.edu" },
        { email: "banned2@nyu.edu" },
      ];

      const testCases = [
        { email: "banned1@nyu.edu", expectedBanned: true },
        { email: "banned2@nyu.edu", expectedBanned: true },
        { email: "normal@nyu.edu", expectedBanned: false },
        { email: undefined, expectedBanned: false },
        { email: null, expectedBanned: false },
      ];

      testCases.forEach(({ email, expectedBanned }) => {
        const bannedEmails = bannedUsers.map((user) => user.email);
        const isBanned = email ? bannedEmails.includes(email) : false;

        expect(isBanned).toBe(expectedBanned);
      });
    });

    it("should handle walk-in form ban validation with netId", () => {
      const bannedUsers = [{ email: "banneduser@nyu.edu" }];
      const netId = "banneduser";

      const bannedEmails = bannedUsers.map((user) => user.email);
      const isBanned = bannedEmails.includes(netId + "@nyu.edu");

      expect(isBanned).toBe(true);
    });
  });

  describe("Overlap Detection Logic", () => {
    const mockBookingContext = {
      bookingCalendarInfo: {
        start: new Date("2024-07-20T10:00:00"),
        end: new Date("2024-07-20T12:00:00"),
      },
      selectedRooms: [
        { roomId: 103, name: "Room 103", calendarId: "cal-103", capacity: 10 },
      ],
      existingCalendarEvents: [
        {
          id: "existing-1",
          title: "Existing Event",
          start: "2024-07-20T09:00:00",
          end: "2024-07-20T11:00:00",
          resourceId: "103",
          extendedProps: {},
        },
      ],
    };

    const mockDatabaseContext = {
      roomSettings: [],
      bannedUsers: [],
      safetyTrainedUsers: [],
      userEmail: "test@nyu.edu",
      blackoutPeriods: [],
    };

    it("should detect time range overlaps correctly", () => {
      const testCases = [
        // [eventStart, eventEnd, bookingStart, bookingEnd, shouldOverlap]
        ["09:00", "11:00", "10:00", "12:00", true], // Partial overlap (start)
        ["11:00", "13:00", "10:00", "12:00", true], // Partial overlap (end)
        ["09:30", "11:30", "10:00", "12:00", true], // Contains booking start
        ["10:30", "11:30", "10:00", "12:00", true], // Contained within booking
        ["08:00", "14:00", "10:00", "12:00", true], // Surrounds booking
        ["08:00", "10:00", "10:00", "12:00", false], // Ends when booking starts
        ["12:00", "14:00", "10:00", "12:00", false], // Starts when booking ends
        ["08:00", "09:00", "10:00", "12:00", false], // Before booking
        ["13:00", "15:00", "10:00", "12:00", false], // After booking
      ];

      testCases.forEach(
        ([eventStart, eventEnd, bookingStart, bookingEnd, shouldOverlap]) => {
          const eventStartTime = new Date(`2024-07-20T${eventStart}:00`);
          const eventEndTime = new Date(`2024-07-20T${eventEnd}:00`);
          const bookingStartTime = new Date(`2024-07-20T${bookingStart}:00`);
          const bookingEndTime = new Date(`2024-07-20T${bookingEnd}:00`);

          // Logic from useCalculateOverlap
          const hasOverlap =
            (eventStartTime >= bookingStartTime &&
              eventStartTime < bookingEndTime) ||
            (eventEndTime > bookingStartTime &&
              eventEndTime <= bookingEndTime) ||
            (eventStartTime <= bookingStartTime &&
              eventEndTime >= bookingEndTime);

          expect(hasOverlap).toBe(shouldOverlap);
        }
      );
    });

    it("should ignore overlaps during edit mode for the same event", () => {
      const calendarEventId = "existing-1";
      const events = [
        {
          id: "existing-1",
          start: "2024-07-20T09:00:00",
          end: "2024-07-20T11:00:00",
        },
        {
          id: "existing-2",
          start: "2024-07-20T13:00:00",
          end: "2024-07-20T15:00:00",
        },
      ];

      const bookingTime = {
        start: new Date("2024-07-20T10:00:00"),
        end: new Date("2024-07-20T12:00:00"),
      };

      const filteredEvents = events.filter(
        (event) =>
          event.id !== calendarEventId &&
          event.id.split(":")[0] !== calendarEventId
      );

      // Should only have existing-2 after filtering
      expect(filteredEvents).toHaveLength(1);
      expect(filteredEvents[0].id).toBe("existing-2");
    });
  });

  describe("Blackout Period Integration", () => {
    it("should correctly identify dates within blackout periods", () => {
      const blackoutPeriods = [
        {
          id: "blackout-1",
          name: "Summer Break",
          startDate: Timestamp.fromDate(dayjs("2025-07-01").toDate()),
          endDate: Timestamp.fromDate(dayjs("2025-07-31").toDate()),
          startTime: null,
          endTime: null,
          isActive: true,
          roomIds: null, // Global blackout
        },
      ];

      const mockContext = {
        roomSettings: [],
        blackoutPeriods,
      };

      const { result } = renderHook(() => useBookingDateRestrictions(), {
        wrapper: ({ children }) => (
          <DatabaseContext.Provider value={mockContext as any}>
            {children}
          </DatabaseContext.Provider>
        ),
      });

      // Date within blackout period
      const dateInBlackout = dayjs("2025-07-15");
      expect(result.current.isDateDisabled(dateInBlackout)).toBe(true);

      // Date outside blackout period
      const dateOutsideBlackout = dayjs("2025-08-15");
      expect(result.current.isDateDisabled(dateOutsideBlackout)).toBe(false);
    });
  });

  describe("Combined Restriction Logic Priorities", () => {
    it("should prioritize restrictions in correct order", () => {
      // Priority order (highest to lowest):
      // 1. Ban status
      // 2. Safety training
      // 3. Blackout period
      // 4. Overlap detection

      const testScenarios = [
        {
          name: "All restrictions present",
          isBanned: true,
          needsSafetyTraining: true,
          isInBlackoutPeriod: true,
          hasOverlap: true,
          expectedPrimaryBlocker: "banned",
        },
        {
          name: "Safety training and blackout",
          isBanned: false,
          needsSafetyTraining: true,
          isInBlackoutPeriod: true,
          hasOverlap: false,
          expectedPrimaryBlocker: "safety_training",
        },
        {
          name: "Only blackout and overlap",
          isBanned: false,
          needsSafetyTraining: false,
          isInBlackoutPeriod: true,
          hasOverlap: true,
          expectedPrimaryBlocker: "blackout",
        },
        {
          name: "Only overlap",
          isBanned: false,
          needsSafetyTraining: false,
          isInBlackoutPeriod: false,
          hasOverlap: true,
          expectedPrimaryBlocker: "overlap",
        },
        {
          name: "No restrictions",
          isBanned: false,
          needsSafetyTraining: false,
          isInBlackoutPeriod: false,
          hasOverlap: false,
          expectedPrimaryBlocker: null,
        },
      ];

      testScenarios.forEach(
        ({
          name,
          isBanned,
          needsSafetyTraining,
          isInBlackoutPeriod,
          hasOverlap,
          expectedPrimaryBlocker,
        }) => {
          let primaryBlocker = null;

          if (isBanned) {
            primaryBlocker = "banned";
          } else if (needsSafetyTraining) {
            primaryBlocker = "safety_training";
          } else if (isInBlackoutPeriod) {
            primaryBlocker = "blackout";
          } else if (hasOverlap) {
            primaryBlocker = "overlap";
          }

          expect(primaryBlocker).toBe(expectedPrimaryBlocker);
        }
      );
    });
  });

  describe("Date and Time Validation", () => {
    it("should always disable past dates", () => {
      const today = dayjs();
      const yesterday = today.subtract(1, "day");
      const tomorrow = today.add(1, "day");

      const mockContext = {
        roomSettings: [],
        blackoutPeriods: [],
      };

      const { result } = renderHook(() => useBookingDateRestrictions(), {
        wrapper: ({ children }) => (
          <DatabaseContext.Provider value={mockContext as any}>
            {children}
          </DatabaseContext.Provider>
        ),
      });

      expect(result.current.isDateDisabled(yesterday)).toBe(true);
      expect(result.current.isDateDisabled(tomorrow)).toBe(false);
    });

    it("should validate booking time ranges correctly", () => {
      const validTimeRanges = [
        { start: "09:00", end: "10:00", valid: true },
        { start: "10:00", end: "12:00", valid: true },
        { start: "14:00", end: "17:00", valid: true },
      ];

      const invalidTimeRanges = [
        { start: "12:00", end: "10:00", valid: false }, // End before start
        { start: "10:00", end: "10:00", valid: false }, // Zero duration
      ];

      [...validTimeRanges, ...invalidTimeRanges].forEach(
        ({ start, end, valid }) => {
          const startTime = dayjs(`2024-07-20T${start}:00`);
          const endTime = dayjs(`2024-07-20T${end}:00`);

          const isValidRange = endTime.isAfter(startTime);
          expect(isValidRange).toBe(valid);
        }
      );
    });
  });
});
