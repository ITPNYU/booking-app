import { describe, expect, it } from "vitest";
import { Role } from "@/components/src/types";
import { getBookingHourLimits } from "@/components/src/client/routes/booking/utils/bookingHourLimits";

describe("getBookingHourLimits", () => {
  it("returns unlimited duration when no rooms provided", () => {
    const { maxHours, minHours } = getBookingHourLimits([], Role.STUDENT, false);
    expect(maxHours).toBe(Number.POSITIVE_INFINITY);
    expect(minHours).toBe(0);
  });

  it("returns unlimited duration when room has no hour settings", () => {
    const rooms = [{ roomId: 1, name: "Test Room" }];
    const { maxHours, minHours } = getBookingHourLimits(rooms, Role.STUDENT, false);
    expect(maxHours).toBe(Number.POSITIVE_INFINITY);
    expect(minHours).toBe(0);
  });

  it("uses regular role limits for non-walk-in booking", () => {
    const rooms = [{
      roomId: 1,
      name: "Test Room",
      maxHour: { student: 2 },
      minHour: { student: 1 }
    }];
    const { maxHours, minHours } = getBookingHourLimits(rooms, Role.STUDENT, false);
    expect(maxHours).toBe(2);
    expect(minHours).toBe(1);
  });

  it("falls back to regular role limits when walk-in limits not defined", () => {
    const rooms = [{
      roomId: 1,
      name: "Test Room",
      maxHour: { student: 2 },
      minHour: { student: 1 }
    }];
    const { maxHours, minHours } = getBookingHourLimits(rooms, Role.STUDENT, true);
    expect(maxHours).toBe(2);
    expect(minHours).toBe(1);
  });

  it("uses walk-in limits when available", () => {
    const rooms = [{
      roomId: 1,
      name: "Test Room",
      maxHour: { student: 4, studentWalkIn: 2 },
      minHour: { student: 0.5, studentWalkIn: 1 }
    }];
    const { maxHours, minHours } = getBookingHourLimits(rooms, Role.STUDENT, true);
    expect(maxHours).toBe(2);
    expect(minHours).toBe(1);
  });

  it("uses most restrictive limits from multiple rooms", () => {
    const rooms = [
      {
        roomId: 1,
        maxHour: { student: 4 },
        minHour: { student: 0.5 }
      },
      {
        roomId: 2,
        maxHour: { student: 2 },
        minHour: { student: 1 }
      }
    ];
    const { maxHours, minHours } = getBookingHourLimits(rooms, Role.STUDENT, false);
    expect(maxHours).toBe(2); // Uses lowest max
    expect(minHours).toBe(1); // Uses highest min
  });

  it("ignores rooms without limits when calculating restrictions", () => {
    const rooms = [
      {
        roomId: 1,
        name: "Room with limits",
        maxHour: { student: 3 },
        minHour: { student: 1 }
      },
      {
        roomId: 2,
        name: "Room without limits"
        // No maxHour/minHour specified
      }
    ];
    const { maxHours, minHours } = getBookingHourLimits(rooms, Role.STUDENT, false);
    expect(maxHours).toBe(3); // Only considers the room with limits
    expect(minHours).toBe(1); // Only considers the room with limits
  });

  it("uses VIP limits when available", () => {
    const rooms = [{
      roomId: 1,
      name: "Test Room",
      maxHour: { student: 2, studentVIP: 8 },
      minHour: { student: 1, studentVIP: 0.5 }
    }];
    const { maxHours, minHours } = getBookingHourLimits(rooms, Role.STUDENT, false, true);
    expect(maxHours).toBe(8);
    expect(minHours).toBe(0.5);
  });

  it("falls back to regular role limits when VIP limits not defined", () => {
    const rooms = [{
      roomId: 1,
      name: "Test Room",
      maxHour: { student: 2 },
      minHour: { student: 1 }
    }];
    const { maxHours, minHours } = getBookingHourLimits(rooms, Role.STUDENT, false, true);
    expect(maxHours).toBe(2);
    expect(minHours).toBe(1);
  });

  it("uses VIP faculty limits for faculty role", () => {
    const rooms = [{
      roomId: 1,
      name: "Test Room",
      maxHour: { faculty: 4, facultyVIP: 12 },
      minHour: { faculty: 0.5, facultyVIP: 0.25 }
    }];
    const { maxHours, minHours } = getBookingHourLimits(rooms, Role.FACULTY, false, true);
    expect(maxHours).toBe(12);
    expect(minHours).toBe(0.25);
  });

  it("uses VIP admin limits for admin role", () => {
    const rooms = [{
      roomId: 1,
      name: "Test Room",
      maxHour: { admin: 6, adminVIP: 16 },
      minHour: { admin: 0.5, adminVIP: 0.25 }
    }];
    const { maxHours, minHours } = getBookingHourLimits(rooms, Role.ADMIN_STAFF, false, true);
    expect(maxHours).toBe(16);
    expect(minHours).toBe(0.25);
  });

  it("prioritizes VIP limits over walk-in when both flags are true", () => {
    const rooms = [{
      roomId: 1,
      name: "Test Room",
      maxHour: { student: 4, studentWalkIn: 2, studentVIP: 8 },
      minHour: { student: 0.5, studentWalkIn: 1, studentVIP: 0.25 }
    }];
    // VIP should take precedence over walk-in
    const { maxHours, minHours } = getBookingHourLimits(rooms, Role.STUDENT, true, true);
    expect(maxHours).toBe(8);
    expect(minHours).toBe(0.25);
  });
});
