import { describe, expect, it } from "vitest";
import { Role } from "@/components/src/types";
import { getBookingHourLimits } from "@/components/src/client/routes/booking/utils/bookingHourLimits";

describe("getBookingHourLimits", () => {
  it("returns default limits when no rooms provided", () => {
    const { maxHours, minHours } = getBookingHourLimits([], Role.STUDENT, false);
    expect(maxHours).toBe(4);
    expect(minHours).toBe(0.5);
  });

  it("returns default limits when room has no hour settings", () => {
    const rooms = [{ roomId: 1, name: "Test Room" }];
    const { maxHours, minHours } = getBookingHourLimits(rooms, Role.STUDENT, false);
    expect(maxHours).toBe(4);
    expect(minHours).toBe(0.5);
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
});
