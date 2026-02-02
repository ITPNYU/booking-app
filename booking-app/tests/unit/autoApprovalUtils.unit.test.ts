import { describe, expect, it } from "vitest";
import type { RoomSetting } from "../../components/src/types";
import {
  checkAutoApprovalEligibility,
  getCombinedHourLimits,
  isRoomAutoApprovalEnabled,
} from "../../lib/utils/autoApprovalUtils";

/** Minimal room with autoApproval for tests */
function room(overrides: Partial<RoomSetting> & { autoApproval?: RoomSetting["autoApproval"] }): RoomSetting {
  return {
    roomId: 1,
    name: "Test Room",
    ...overrides,
  } as RoomSetting;
}

describe("autoApprovalUtils", () => {
  describe("isRoomAutoApprovalEnabled", () => {
    it("returns false when autoApproval is undefined", () => {
      expect(isRoomAutoApprovalEnabled(room({ autoApproval: undefined }))).toBe(false);
    });

    it("returns false when autoApproval is null", () => {
      expect(isRoomAutoApprovalEnabled(room({ autoApproval: null as unknown as RoomSetting["autoApproval"] }))).toBe(false);
    });

    it("returns false when autoApproval is empty object", () => {
      expect(isRoomAutoApprovalEnabled(room({ autoApproval: {} }))).toBe(false);
    });

    it("returns true when autoApproval has minHour", () => {
      expect(
        isRoomAutoApprovalEnabled(
          room({
            autoApproval: {
              minHour: { admin: -1, faculty: -1, student: -1 },
              maxHour: { admin: -1, faculty: -1, student: -1 },
            },
          })
        )
      ).toBe(true);
    });

    it("returns true when autoApproval has conditions", () => {
      expect(
        isRoomAutoApprovalEnabled(
          room({
            autoApproval: {
              conditions: {
                setup: false,
                equipment: false,
                staffing: false,
                catering: false,
                cleaning: false,
                security: false,
              },
            },
          })
        )
      ).toBe(true);
    });
  });

  describe("getCombinedHourLimits", () => {
    it("returns -1, -1 when no rooms provided", () => {
      const result = getCombinedHourLimits([], "student");
      expect(result).toEqual({ minHours: -1, maxHours: -1 });
    });

    it("returns -1, -1 when rooms have no hour limits", () => {
      const rooms = [
        room({
          autoApproval: {
            conditions: { setup: false, equipment: false, staffing: false, catering: false, cleaning: false, security: false },
          },
        }),
      ];
      const result = getCombinedHourLimits(rooms, "student");
      expect(result).toEqual({ minHours: -1, maxHours: -1 });
    });

    it("returns room limits for student when role is student", () => {
      const rooms = [
        room({
          autoApproval: {
            minHour: { admin: -1, faculty: -1, student: 1 },
            maxHour: { admin: -1, faculty: -1, student: 4 },
          },
        }),
      ];
      const result = getCombinedHourLimits(rooms, "student");
      expect(result).toEqual({ minHours: 1, maxHours: 4 });
    });

    it("normalizes role to student when role is undefined", () => {
      const rooms = [
        room({
          autoApproval: {
            minHour: { admin: -1, faculty: -1, student: 0.5 },
            maxHour: { admin: -1, faculty: -1, student: 2 },
          },
        }),
      ];
      const result = getCombinedHourLimits(rooms);
      expect(result).toEqual({ minHours: 0.5, maxHours: 2 });
    });

    it("normalizes admin-like roles to admin", () => {
      const rooms = [
        room({
          autoApproval: {
            minHour: { admin: 0.5, faculty: -1, student: -1 },
            maxHour: { admin: 8, faculty: -1, student: -1 },
          },
        }),
      ];
      expect(getCombinedHourLimits(rooms, "admin")).toEqual({ minHours: 0.5, maxHours: 8 });
      expect(getCombinedHourLimits(rooms, "staff")).toEqual({ minHours: 0.5, maxHours: 8 });
      expect(getCombinedHourLimits(rooms, "chair")).toEqual({ minHours: 0.5, maxHours: 8 });
      expect(getCombinedHourLimits(rooms, "director")).toEqual({ minHours: 0.5, maxHours: 8 });
    });

    it("normalizes faculty-like roles to faculty", () => {
      const rooms = [
        room({
          autoApproval: {
            minHour: { admin: -1, faculty: 1, student: -1 },
            maxHour: { admin: -1, faculty: 6, student: -1 },
          },
        }),
      ];
      expect(getCombinedHourLimits(rooms, "faculty")).toEqual({ minHours: 1, maxHours: 6 });
      expect(getCombinedHourLimits(rooms, "fellow")).toEqual({ minHours: 1, maxHours: 6 });
      expect(getCombinedHourLimits(rooms, "resident")).toEqual({ minHours: 1, maxHours: 6 });
    });

    it("uses most restrictive limits across multiple rooms", () => {
      const rooms = [
        room({
          roomId: 1,
          autoApproval: {
            minHour: { admin: -1, faculty: -1, student: 0.5 },
            maxHour: { admin: -1, faculty: -1, student: 4 },
          },
        }),
        room({
          roomId: 2,
          autoApproval: {
            minHour: { admin: -1, faculty: -1, student: 1 },
            maxHour: { admin: -1, faculty: -1, student: 2 },
          },
        }),
      ];
      const result = getCombinedHourLimits(rooms, "student");
      expect(result.minHours).toBe(1); // highest min
      expect(result.maxHours).toBe(2); // lowest max
    });

    it("treats -1 as no limit for that role", () => {
      const rooms = [
        room({
          autoApproval: {
            minHour: { admin: -1, faculty: -1, student: -1 },
            maxHour: { admin: -1, faculty: -1, student: -1 },
          },
        }),
      ];
      const result = getCombinedHourLimits(rooms, "student");
      expect(result).toEqual({ minHours: -1, maxHours: -1 });
    });
  });

  describe("checkAutoApprovalEligibility", () => {
    const roomsWithAutoApproval = [
      room({
        autoApproval: {
          minHour: { admin: -1, faculty: -1, student: -1 },
          maxHour: { admin: -1, faculty: -1, student: -1 },
          conditions: {
            setup: true,
            equipment: true,
            staffing: false,
            catering: false,
            cleaning: false,
            security: false,
          },
        },
      }),
    ];

    it("returns canAutoApprove true for VIP booking", () => {
      const result = checkAutoApprovalEligibility({
        selectedRooms: [],
        isVip: true,
      });
      expect(result.canAutoApprove).toBe(true);
      expect(result.reason).toBe("VIP booking");
    });

    it("returns canAutoApprove true for walk-in booking", () => {
      const result = checkAutoApprovalEligibility({
        selectedRooms: [],
        isWalkIn: true,
      });
      expect(result.canAutoApprove).toBe(true);
      expect(result.reason).toBe("Walk-in booking");
    });

    it("returns canAutoApprove false when no rooms selected", () => {
      const result = checkAutoApprovalEligibility({
        selectedRooms: [],
        isWalkIn: false,
        isVip: false,
      });
      expect(result.canAutoApprove).toBe(false);
      expect(result.reason).toBe("No rooms selected");
    });

    it("returns canAutoApprove false when one or more rooms do not have auto-approval enabled", () => {
      const result = checkAutoApprovalEligibility({
        selectedRooms: [
          room({
            autoApproval: {
              minHour: { admin: -1, faculty: -1, student: 0 },
              maxHour: { admin: -1, faculty: -1, student: 4 },
              conditions: { setup: false, equipment: false, staffing: false, catering: false, cleaning: false, security: false },
            },
          }),
          room({ autoApproval: undefined }), // disabled
        ],
        isWalkIn: false,
        isVip: false,
      });
      expect(result.canAutoApprove).toBe(false);
      expect(result.reason).toBe("One or more selected rooms do not have auto-approval enabled");
    });

    it("returns canAutoApprove false when duration is below minimum for role", () => {
      const rooms = [
        room({
          autoApproval: {
            minHour: { admin: -1, faculty: -1, student: 2 },
            maxHour: { admin: -1, faculty: -1, student: 4 },
            conditions: { setup: false, equipment: false, staffing: false, catering: false, cleaning: false, security: false },
          },
        }),
      ];
      const result = checkAutoApprovalEligibility({
        selectedRooms: rooms,
        role: "student",
        durationHours: 1,
        isWalkIn: false,
        isVip: false,
      });
      expect(result.canAutoApprove).toBe(false);
      expect(result.reason).toContain("below minimum");
      expect(result.details).toEqual({ minHours: 2, maxHours: 4, durationHours: 1 });
    });

    it("returns canAutoApprove false when duration exceeds maximum for role", () => {
      const rooms = [
        room({
          autoApproval: {
            minHour: { admin: -1, faculty: -1, student: 0.5 },
            maxHour: { admin: -1, faculty: -1, student: 2 },
            conditions: { setup: false, equipment: false, staffing: false, catering: false, cleaning: false, security: false },
          },
        }),
      ];
      const result = checkAutoApprovalEligibility({
        selectedRooms: rooms,
        role: "student",
        durationHours: 3,
        isWalkIn: false,
        isVip: false,
      });
      expect(result.canAutoApprove).toBe(false);
      expect(result.reason).toContain("exceeds maximum");
      expect(result.details).toEqual({ minHours: 0.5, maxHours: 2, durationHours: 3 });
    });

    it("returns canAutoApprove false when requested service is not allowed in room conditions", () => {
      const rooms = [
        room({
          autoApproval: {
            minHour: { admin: -1, faculty: -1, student: -1 },
            maxHour: { admin: -1, faculty: -1, student: -1 },
            conditions: {
              setup: true,
              equipment: false, // not allowed
              staffing: false,
              catering: false,
              cleaning: false,
              security: false,
            },
          },
        }),
      ];
      const result = checkAutoApprovalEligibility({
        selectedRooms: rooms,
        servicesRequested: { equipment: true },
        isWalkIn: false,
        isVip: false,
      });
      expect(result.canAutoApprove).toBe(false);
      expect(result.reason).toContain("equipment");
      expect(result.reason).toContain("not allowed");
    });

    it("returns canAutoApprove false when one of multiple rooms does not allow requested service", () => {
      const rooms = [
        room({
          roomId: 1,
          autoApproval: {
            minHour: { admin: -1, faculty: -1, student: -1 },
            maxHour: { admin: -1, faculty: -1, student: -1 },
            conditions: { setup: true, equipment: true, staffing: false, catering: false, cleaning: false, security: false },
          },
        }),
        room({
          roomId: 2,
          autoApproval: {
            minHour: { admin: -1, faculty: -1, student: -1 },
            maxHour: { admin: -1, faculty: -1, student: -1 },
            conditions: { setup: false, equipment: true, staffing: false, catering: false, cleaning: false, security: false },
          },
        }),
      ];
      const result = checkAutoApprovalEligibility({
        selectedRooms: rooms,
        servicesRequested: { setup: true },
        isWalkIn: false,
        isVip: false,
      });
      expect(result.canAutoApprove).toBe(false);
      expect(result.reason).toContain("setup");
    });

    it("returns canAutoApprove true when no services requested and rooms have auto-approval", () => {
      const result = checkAutoApprovalEligibility({
        selectedRooms: roomsWithAutoApproval,
        isWalkIn: false,
        isVip: false,
      });
      expect(result.canAutoApprove).toBe(true);
      expect(result.reason).toBe("All auto-approval conditions met");
    });

    it("returns canAutoApprove true when requested services are all allowed", () => {
      const result = checkAutoApprovalEligibility({
        selectedRooms: roomsWithAutoApproval,
        servicesRequested: { setup: true, equipment: true },
        isWalkIn: false,
        isVip: false,
      });
      expect(result.canAutoApprove).toBe(true);
      expect(result.reason).toBe("All auto-approval conditions met");
    });

    it("returns canAutoApprove true when duration is within min/max and no services", () => {
      const rooms = [
        room({
          autoApproval: {
            minHour: { admin: -1, faculty: -1, student: 1 },
            maxHour: { admin: -1, faculty: -1, student: 4 },
            conditions: { setup: false, equipment: false, staffing: false, catering: false, cleaning: false, security: false },
          },
        }),
      ];
      const result = checkAutoApprovalEligibility({
        selectedRooms: rooms,
        role: "student",
        durationHours: 2,
        isWalkIn: false,
        isVip: false,
      });
      expect(result.canAutoApprove).toBe(true);
      expect(result.reason).toBe("All auto-approval conditions met");
    });

    it("does not check duration when durationHours is undefined", () => {
      const rooms = [
        room({
          autoApproval: {
            minHour: { admin: -1, faculty: -1, student: 1 },
            maxHour: { admin: -1, faculty: -1, student: 4 },
            conditions: { setup: false, equipment: false, staffing: false, catering: false, cleaning: false, security: false },
          },
        }),
      ];
      const result = checkAutoApprovalEligibility({
        selectedRooms: rooms,
        role: "student",
        // no durationHours
        isWalkIn: false,
        isVip: false,
      });
      expect(result.canAutoApprove).toBe(true);
    });

    it("treats empty servicesRequested as no services requested", () => {
      const result = checkAutoApprovalEligibility({
        selectedRooms: roomsWithAutoApproval,
        servicesRequested: {},
        isWalkIn: false,
        isVip: false,
      });
      expect(result.canAutoApprove).toBe(true);
    });

    it("treats undefined servicesRequested as no services requested", () => {
      const result = checkAutoApprovalEligibility({
        selectedRooms: roomsWithAutoApproval,
        isWalkIn: false,
        isVip: false,
      });
      expect(result.canAutoApprove).toBe(true);
    });
  });
});
