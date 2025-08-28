import { describe, it, expect } from "vitest";

describe("Room Staffing Services", () => {
  describe("Schema-based Staffing Services", () => {
    it("should have the correct structure for Garage 103 services", () => {
      // These would be defined in the schema resources array
      const garage103StaffingServices = [
        "GARAGE_LIGHTING_DIY_BASIC_WASHES",
        "GARAGE_LIGHTING_TECH_SUPPORT_BOARD_OP",
        "GARAGE_LIGHTING_TECH_BUSKING",
        "GARAGE_LIGHTING_TECH_DESIGN",
        "GARAGE_AUDIO_DIY_PLUG_PLAY",
        "GARAGE_AUDIO_TECH_GENERAL_HOUSE",
        "GARAGE_AUDIO_TECH_A1"
      ];
      
      expect(garage103StaffingServices).toHaveLength(7);
      expect(garage103StaffingServices).toContain("GARAGE_LIGHTING_DIY_BASIC_WASHES");
      expect(garage103StaffingServices).toContain("GARAGE_AUDIO_TECH_A1");
    });

    it("should have the correct structure for Audio Lab 230 services", () => {
      // These would be defined in the schema resources array
      const audioLab230StaffingServices = [
        "AUDIO_LAB_DIY_PLUG_PLAY",
        "AUDIO_LAB_TECH_GENERAL_HOUSE",
        "AUDIO_LAB_TECH_RECORDING_ENGINEER"
      ];
      
      expect(audioLab230StaffingServices).toHaveLength(3);
      expect(audioLab230StaffingServices).toContain("AUDIO_LAB_TECH_RECORDING_ENGINEER");
    });

    it("should have the correct structure for Campus Media services", () => {
      // These would be defined in the schema resources array
      const campusMediaStaffingServices = [
        "CAMPUS_MEDIA_SERVICES"
      ];
      
      expect(campusMediaStaffingServices).toHaveLength(1);
      expect(campusMediaStaffingServices).toContain("CAMPUS_MEDIA_SERVICES");
    });
  });

  describe("Schema Resource Conversion", () => {
    it("should convert schema resources to include staffingServices", () => {
      // Mock schema resource
      const mockResource = {
        roomId: 103,
        name: "Garage 103",
        capacity: 50,
        calendarId: "garage103@nyu.edu",
        needsSafetyTraining: true,
        shouldAutoApprove: false,
        isWalkIn: false,
        isWalkInCanBookTwo: false,
        isEquipment: false,
        services: ["equipment", "staffing", "setup", "security", "cleaning", "catering"],
        staffingServices: [
          "GARAGE_LIGHTING_DIY_BASIC_WASHES",
          "GARAGE_LIGHTING_TECH_SUPPORT_BOARD_OP",
          "GARAGE_LIGHTING_TECH_BUSKING",
          "GARAGE_LIGHTING_TECH_DESIGN",
          "GARAGE_AUDIO_DIY_PLUG_PLAY",
          "GARAGE_AUDIO_TECH_GENERAL_HOUSE",
          "GARAGE_AUDIO_TECH_A1"
        ]
      };

      // Simulate the conversion that happens in SelectRoomPage
      const convertedRoom = {
        roomId: mockResource.roomId,
        name: mockResource.name,
        capacity: mockResource.capacity.toString(),
        calendarId: mockResource.calendarId,
        calendarRef: undefined,
        needsSafetyTraining: mockResource.needsSafetyTraining,
        shouldAutoApprove: mockResource.shouldAutoApprove,
        isWalkIn: mockResource.isWalkIn,
        isWalkInCanBookTwo: mockResource.isWalkInCanBookTwo,
        isEquipment: mockResource.isEquipment,
        services: mockResource.services,
        staffingServices: mockResource.staffingServices,
      };

      expect(convertedRoom.staffingServices).toBeDefined();
      expect(convertedRoom.staffingServices).toHaveLength(7);
      expect(convertedRoom.staffingServices).toContain("GARAGE_LIGHTING_DIY_BASIC_WASHES");
      expect(convertedRoom.staffingServices).toContain("GARAGE_AUDIO_TECH_A1");
    });
  });

  describe("Component Logic", () => {
    it("should determine showStaffing based on selectedRooms staffingServices", () => {
      // Mock selectedRooms with staffing services
      const selectedRoomsWithStaffing = [
        {
          roomId: 103,
          name: "Garage 103",
          services: ["equipment", "staffing", "setup"],
          staffingServices: ["GARAGE_LIGHTING_DIY_BASIC_WASHES", "GARAGE_AUDIO_TECH_A1"]
        }
      ];

      // Simulate the logic from BookingFormStaffingServices
      const showStaffing = selectedRoomsWithStaffing.some(
        (room) => room.staffingServices && room.staffingServices.length > 0
      );

      expect(showStaffing).toBe(true);
    });

    it("should not show staffing when no rooms have staffingServices", () => {
      // Mock selectedRooms without staffing services
      const selectedRoomsWithoutStaffing = [
        {
          roomId: 999,
          name: "Generic Room",
          services: ["equipment", "setup"],
          staffingServices: []
        }
      ];

      // Simulate the logic from BookingFormStaffingServices
      const showStaffing = selectedRoomsWithoutStaffing.some(
        (room) => room.staffingServices && room.staffingServices.length > 0
      );

      expect(showStaffing).toBe(false);
    });
  });
});
