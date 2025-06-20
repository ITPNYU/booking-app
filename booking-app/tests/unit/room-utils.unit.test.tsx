import { describe, expect, it } from "vitest";

describe("Room Utils", () => {
  describe("calculateMaxCapacity", () => {
    const calculateMaxCapacity = (
      selectedRooms: Array<{ capacity: string }>
    ) => {
      return selectedRooms.reduce((sum, room) => {
        return sum + parseInt(room.capacity);
      }, 0);
    };

    it("calculates total capacity for multiple rooms", () => {
      const rooms = [
        { capacity: "10" },
        { capacity: "15" },
        { capacity: "20" },
      ];
      expect(calculateMaxCapacity(rooms)).toBe(45);
    });

    it("handles single room", () => {
      const rooms = [{ capacity: "25" }];
      expect(calculateMaxCapacity(rooms)).toBe(25);
    });

    it("handles empty room list", () => {
      expect(calculateMaxCapacity([])).toBe(0);
    });

    it("handles rooms with zero capacity", () => {
      const rooms = [{ capacity: "0" }, { capacity: "10" }];
      expect(calculateMaxCapacity(rooms)).toBe(10);
    });
  });

  describe("formatRoomName", () => {
    const formatRoomName = (roomId: number, name: string) => {
      return `${roomId} ${name}`;
    };

    it("formats room name correctly", () => {
      expect(formatRoomName(101, "Conference Room A")).toBe(
        "101 Conference Room A"
      );
      expect(formatRoomName(202, "Study Room")).toBe("202 Study Room");
    });

    it("handles room with empty name", () => {
      expect(formatRoomName(303, "")).toBe("303 ");
    });
  });

  describe("selectedAutoApprovalRooms", () => {
    const INSTANT_APPROVAL_ROOMS = [1, 2, 3, 4];
    const WALK_IN_CAN_BOOK_TWO = [5, 6];

    const selectedAutoApprovalRooms = (selectedRoomIds: number[]) => {
      if (selectedRoomIds.length < 2) return true;
      if (selectedRoomIds.length > 2) return false;
      if (
        WALK_IN_CAN_BOOK_TWO.includes(selectedRoomIds[0]) &&
        WALK_IN_CAN_BOOK_TWO.includes(selectedRoomIds[1])
      )
        return true;
      return false;
    };

    it("returns true for single room", () => {
      expect(selectedAutoApprovalRooms([1])).toBe(true);
      expect(selectedAutoApprovalRooms([5])).toBe(true);
    });

    it("returns false for more than 2 rooms", () => {
      expect(selectedAutoApprovalRooms([1, 2, 3])).toBe(false);
      expect(selectedAutoApprovalRooms([1, 2, 3, 4])).toBe(false);
    });

    it("returns true for 2 rooms that can be booked together", () => {
      expect(selectedAutoApprovalRooms([5, 6])).toBe(true);
      expect(selectedAutoApprovalRooms([6, 5])).toBe(true);
    });

    it("returns false for 2 rooms that cannot be booked together", () => {
      expect(selectedAutoApprovalRooms([1, 3])).toBe(false);
      expect(selectedAutoApprovalRooms([1, 5])).toBe(false);
      expect(selectedAutoApprovalRooms([2, 6])).toBe(false);
    });
  });

  describe("isRoomAvailable", () => {
    const isRoomAvailable = (
      roomId: number,
      startTime: string,
      endTime: string,
      existingBookings: Array<{ roomId: number; start: string; end: string }>
    ) => {
      return !existingBookings.some((booking) => {
        if (booking.roomId !== roomId) return false;

        const bookingStart = new Date(booking.start);
        const bookingEnd = new Date(booking.end);
        const requestStart = new Date(startTime);
        const requestEnd = new Date(endTime);

        // Check for overlap
        return requestStart < bookingEnd && requestEnd > bookingStart;
      });
    };

    const existingBookings = [
      { roomId: 1, start: "2024-01-01T10:00:00", end: "2024-01-01T12:00:00" },
      { roomId: 1, start: "2024-01-01T14:00:00", end: "2024-01-01T16:00:00" },
      { roomId: 2, start: "2024-01-01T11:00:00", end: "2024-01-01T13:00:00" },
    ];

    it("returns true when room is available", () => {
      // Room 1 is free from 12:00 to 14:00
      expect(
        isRoomAvailable(
          1,
          "2024-01-01T12:30:00",
          "2024-01-01T13:30:00",
          existingBookings
        )
      ).toBe(true);

      // Room 3 has no bookings
      expect(
        isRoomAvailable(
          3,
          "2024-01-01T10:00:00",
          "2024-01-01T12:00:00",
          existingBookings
        )
      ).toBe(true);
    });

    it("returns false when room is occupied", () => {
      // Overlaps with 10:00-12:00 booking
      expect(
        isRoomAvailable(
          1,
          "2024-01-01T11:00:00",
          "2024-01-01T13:00:00",
          existingBookings
        )
      ).toBe(false);

      // Exactly matches existing booking
      expect(
        isRoomAvailable(
          1,
          "2024-01-01T10:00:00",
          "2024-01-01T12:00:00",
          existingBookings
        )
      ).toBe(false);
    });

    it("handles edge cases correctly", () => {
      // Booking ends exactly when new booking starts (should be available)
      expect(
        isRoomAvailable(
          1,
          "2024-01-01T12:00:00",
          "2024-01-01T13:00:00",
          existingBookings
        )
      ).toBe(true);

      // New booking ends exactly when existing booking starts (should be available)
      expect(
        isRoomAvailable(
          1,
          "2024-01-01T09:00:00",
          "2024-01-01T10:00:00",
          existingBookings
        )
      ).toBe(true);
    });
  });
});
