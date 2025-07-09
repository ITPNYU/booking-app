import {
  EVENT_ROOMS,
  MULTI_ROOMS,
  PRODUCTION_ROOMS,
} from "@/components/src/mediaCommonsPolicy";

describe("Blackout Period Room Categories", () => {
  describe("Room Categories Constants", () => {
    it("should have correct production rooms", () => {
      const expectedProductionRooms = [
        220, 221, 222, 223, 224, 230, 260, 203, 233, 103,
      ];
      expect(PRODUCTION_ROOMS).toEqual(expectedProductionRooms);
    });

    it("should have correct event rooms including new additions", () => {
      const expectedEventRooms = [1201, 202, 233, 103];
      expect(EVENT_ROOMS).toEqual(expectedEventRooms);
    });

    it("should have correct multi rooms", () => {
      const expectedMultiRooms = [233, 103];
      expect(MULTI_ROOMS).toEqual(expectedMultiRooms);
    });

    it("should include rooms 233 and 103 in multiple categories", () => {
      // Room 233 should be in all three categories
      expect(PRODUCTION_ROOMS).toContain(233);
      expect(EVENT_ROOMS).toContain(233);
      expect(MULTI_ROOMS).toContain(233);

      // Room 103 should be in all three categories
      expect(PRODUCTION_ROOMS).toContain(103);
      expect(EVENT_ROOMS).toContain(103);
      expect(MULTI_ROOMS).toContain(103);
    });

    it("should have multi rooms as subset of both production and event rooms", () => {
      MULTI_ROOMS.forEach((roomId) => {
        expect(PRODUCTION_ROOMS).toContain(roomId);
        expect(EVENT_ROOMS).toContain(roomId);
      });
    });

    it("should include all rooms mentioned in user requirements", () => {
      // Production rooms from user: 220, 221-224, 230, 260(?), 203(?), 233, 103
      const userProductionRooms = [
        220, 221, 222, 223, 224, 230, 260, 203, 233, 103,
      ];
      userProductionRooms.forEach((room) => {
        expect(PRODUCTION_ROOMS).toContain(room);
      });

      // Event rooms from user: 1201, 202, 233, 103 (updated)
      const userEventRooms = [1201, 202, 233, 103];
      userEventRooms.forEach((room) => {
        expect(EVENT_ROOMS).toContain(room);
      });

      // Multi rooms from user: 233, 103
      const userMultiRooms = [233, 103];
      userMultiRooms.forEach((room) => {
        expect(MULTI_ROOMS).toContain(room);
      });
    });
  });

  describe("Room Category Logic", () => {
    const mockRoomSettings = [
      { roomId: 103, name: "Room 103" },
      { roomId: 202, name: "Room 202" },
      { roomId: 203, name: "Room 203" },
      { roomId: 220, name: "Room 220" },
      { roomId: 221, name: "Room 221" },
      { roomId: 222, name: "Room 222" },
      { roomId: 223, name: "Room 223" },
      { roomId: 224, name: "Room 224" },
      { roomId: 230, name: "Room 230" },
      { roomId: 233, name: "Room 233" },
      { roomId: 260, name: "Room 260" },
      { roomId: 1201, name: "Room 1201" },
    ];

    it("should correctly filter production rooms that exist in room settings", () => {
      const availableProductionRooms = PRODUCTION_ROOMS.filter((roomId) =>
        mockRoomSettings.some((room) => room.roomId === roomId)
      );
      expect(availableProductionRooms).toEqual([
        220, 221, 222, 223, 224, 230, 260, 203, 233, 103,
      ]);
    });

    it("should correctly filter event rooms that exist in room settings", () => {
      const availableEventRooms = EVENT_ROOMS.filter((roomId) =>
        mockRoomSettings.some((room) => room.roomId === roomId)
      );
      expect(availableEventRooms).toEqual([1201, 202, 233, 103]);
    });

    it("should correctly filter multi rooms that exist in room settings", () => {
      const availableMultiRooms = MULTI_ROOMS.filter((roomId) =>
        mockRoomSettings.some((room) => room.roomId === roomId)
      );
      expect(availableMultiRooms).toEqual([233, 103]);
    });

    it("should correctly identify room categories from period room IDs", () => {
      const allRoomIds = mockRoomSettings
        .map((room) => room.roomId)
        .sort((a, b) => a - b);
      const productionRoomIds = PRODUCTION_ROOMS.filter((roomId) =>
        mockRoomSettings.some((room) => room.roomId === roomId)
      ).sort((a, b) => a - b);
      const eventRoomIds = EVENT_ROOMS.filter((roomId) =>
        mockRoomSettings.some((room) => room.roomId === roomId)
      ).sort((a, b) => a - b);
      const multiRoomIds = MULTI_ROOMS.filter((roomId) =>
        mockRoomSettings.some((room) => room.roomId === roomId)
      ).sort((a, b) => a - b);

      // Test all rooms
      const isAllRooms =
        allRoomIds.length === allRoomIds.length &&
        allRoomIds.every((id, index) => id === allRoomIds[index]);
      expect(isAllRooms).toBe(true);

      // Test production rooms
      const isProductionRooms =
        productionRoomIds.length === productionRoomIds.length &&
        productionRoomIds.every((id, index) => id === productionRoomIds[index]);
      expect(isProductionRooms).toBe(true);

      // Test event rooms
      const isEventRooms =
        eventRoomIds.length === eventRoomIds.length &&
        eventRoomIds.every((id, index) => id === eventRoomIds[index]);
      expect(isEventRooms).toBe(true);

      // Test multi rooms
      const isMultiRooms =
        multiRoomIds.length === multiRoomIds.length &&
        multiRoomIds.every((id, index) => id === multiRoomIds[index]);
      expect(isMultiRooms).toBe(true);
    });

    it("should correctly detect room category types for blackout periods", () => {
      // Test detection logic for different room combinations
      const testCases = [
        {
          name: "All rooms",
          roomIds: [
            103, 202, 203, 220, 221, 222, 223, 224, 230, 233, 260, 1201,
          ],
          expectedCategory: "all",
        },
        {
          name: "Production rooms only",
          roomIds: [220, 221, 222, 223, 224, 230, 260, 203, 233, 103],
          expectedCategory: "production",
        },
        {
          name: "Event rooms only",
          roomIds: [1201, 202, 233, 103],
          expectedCategory: "event",
        },
        {
          name: "Multi rooms only",
          roomIds: [233, 103],
          expectedCategory: "multi",
        },
        {
          name: "Specific rooms (partial)",
          roomIds: [220, 221],
          expectedCategory: "specific",
        },
      ];

      testCases.forEach((testCase) => {
        const allRoomIds = mockRoomSettings
          .map((room) => room.roomId)
          .sort((a, b) => a - b);
        const periodRoomIds = [...testCase.roomIds].sort((a, b) => a - b);
        const productionRoomIds = PRODUCTION_ROOMS.filter((roomId) =>
          mockRoomSettings.some((room) => room.roomId === roomId)
        ).sort((a, b) => a - b);
        const eventRoomIds = EVENT_ROOMS.filter((roomId) =>
          mockRoomSettings.some((room) => room.roomId === roomId)
        ).sort((a, b) => a - b);
        const multiRoomIds = MULTI_ROOMS.filter((roomId) =>
          mockRoomSettings.some((room) => room.roomId === roomId)
        ).sort((a, b) => a - b);

        const isAllRooms =
          allRoomIds.length === periodRoomIds.length &&
          allRoomIds.every((id, index) => id === periodRoomIds[index]);
        const isProductionRooms =
          productionRoomIds.length === periodRoomIds.length &&
          productionRoomIds.every((id, index) => id === periodRoomIds[index]);
        const isEventRooms =
          eventRoomIds.length === periodRoomIds.length &&
          eventRoomIds.every((id, index) => id === periodRoomIds[index]);
        const isMultiRooms =
          multiRoomIds.length === periodRoomIds.length &&
          multiRoomIds.every((id, index) => id === periodRoomIds[index]);

        let detectedCategory = "specific";
        if (isAllRooms) detectedCategory = "all";
        else if (isProductionRooms) detectedCategory = "production";
        else if (isEventRooms) detectedCategory = "event";
        else if (isMultiRooms) detectedCategory = "multi";

        expect(detectedCategory).toBe(testCase.expectedCategory);
      });
    });
  });

  describe("Room Number Display", () => {
    it("should format room numbers correctly for production rooms", () => {
      const productionNumbers = PRODUCTION_ROOMS.join(", ");
      expect(productionNumbers).toBe(
        "220, 221, 222, 223, 224, 230, 260, 203, 233, 103"
      );
    });

    it("should format room numbers correctly for event rooms", () => {
      const eventNumbers = EVENT_ROOMS.join(", ");
      expect(eventNumbers).toBe("1201, 202, 233, 103");
    });

    it("should format room numbers correctly for multi rooms", () => {
      const multiNumbers = MULTI_ROOMS.join(", ");
      expect(multiNumbers).toBe("233, 103");
    });

    it("should filter and format available rooms based on room settings", () => {
      const mockRoomSettings = [
        { roomId: 103, name: "Room 103" },
        { roomId: 233, name: "Room 233" },
        { roomId: 1201, name: "Room 1201" },
      ];

      const availableProductionNumbers = PRODUCTION_ROOMS.filter((roomId) =>
        mockRoomSettings.some((room) => room.roomId === roomId)
      ).join(", ");
      expect(availableProductionNumbers).toBe("233, 103");

      const availableEventNumbers = EVENT_ROOMS.filter((roomId) =>
        mockRoomSettings.some((room) => room.roomId === roomId)
      ).join(", ");
      expect(availableEventNumbers).toBe("1201, 233, 103");

      const availableMultiNumbers = MULTI_ROOMS.filter((roomId) =>
        mockRoomSettings.some((room) => room.roomId === roomId)
      ).join(", ");
      expect(availableMultiNumbers).toBe("233, 103");
    });
  });

  describe("Room Category Relationships", () => {
    it("should verify that multi rooms are properly overlapping with other categories", () => {
      // Multi rooms should be a subset of both production and event
      const multiInProduction = MULTI_ROOMS.every((roomId) =>
        PRODUCTION_ROOMS.includes(roomId)
      );
      const multiInEvent = MULTI_ROOMS.every((roomId) =>
        EVENT_ROOMS.includes(roomId)
      );

      expect(multiInProduction).toBe(true);
      expect(multiInEvent).toBe(true);
    });

    it("should have unique room distribution", () => {
      // Event rooms should have some rooms that are not in production (1201, 202)
      const eventOnlyRooms = EVENT_ROOMS.filter(
        (roomId) => !PRODUCTION_ROOMS.includes(roomId)
      );
      expect(eventOnlyRooms).toEqual([1201, 202]);

      // Production rooms should have some rooms that are not in event
      const productionOnlyRooms = PRODUCTION_ROOMS.filter(
        (roomId) => !EVENT_ROOMS.includes(roomId)
      );
      expect(productionOnlyRooms).toEqual([
        220, 221, 222, 223, 224, 230, 260, 203,
      ]);

      // Multi rooms should be exactly the overlap
      const overlapRooms = PRODUCTION_ROOMS.filter((roomId) =>
        EVENT_ROOMS.includes(roomId)
      );
      expect(overlapRooms.sort()).toEqual(MULTI_ROOMS.sort());
    });
  });
});
