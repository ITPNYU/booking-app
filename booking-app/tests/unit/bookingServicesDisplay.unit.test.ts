import { describe, expect, it } from "vitest";
import {
  formatServicesDescriptionHtml,
  getBookingServicesByRoom,
  hasBookingServicesDisplay,
} from "@/components/src/utils/bookingServicesDisplay";
import type { ServiceResourceLike } from "@/components/src/utils/resourceServicesUtils";

const screeningRoom: ServiceResourceLike = {
  resourceId: "202",
  name: "Screening Room",
  services: {
    catering: { label: "Catering?", toggle: "optional" },
    equipment: { label: "Equipment", showDetailsField: true },
  },
};

const garage: ServiceResourceLike = {
  resourceId: "103",
  name: "The Garage",
  services: {
    security: {
      label: "Campus Safety",
      mode: "radio",
      options: [
        { value: "willoughby", label: "Willoughby Street Entrance" },
        { value: "main_entrance", label: "Main Entrance" },
      ],
    },
    setup: {
      label: "Room Setup",
      mode: "radio",
      defaultValue: "103_LAYOUT_0",
      options: [
        { value: "103_LAYOUT_0", label: "Standing Room (no chairs) - 91 Standing" },
        {
          value: "103_LAYOUT_1",
          label: "Audience Layout 1 - 44 Seated*",
        },
      ],
    },
    annex: { label: "Auxiliary Spaces" },
  },
};

describe("getBookingServicesByRoom", () => {
  it("groups requested services under each booked room", () => {
    const display = getBookingServicesByRoom(
      {
        roomId: "202, 103",
        cateringByRoom: { "202": "yes" },
        chartFieldForCateringByRoom: { "202": "123-456" },
        hireSecurityByRoom: { "103": "willoughby" },
        chartFieldForSecurityByRoom: { "103": "sec-1" },
      },
      [screeningRoom, garage],
    );

    expect(display.bookingLevel).toEqual([]);
    expect(display.rooms.map((room) => room.title)).toEqual([
      "202 Screening Room",
      "103 The Garage",
    ]);
    expect(display.rooms[0].rows).toEqual([
      { key: "catering", label: "Catering", value: "Yes", chartField: "123-456" },
    ]);
    expect(display.rooms[1].rows).toEqual([
      {
        key: "security",
        label: "Campus Safety",
        value: "Willoughby Street Entrance",
        chartField: "sec-1",
      },
    ]);
  });

  it("hides empty, no, none, and passive default setup values", () => {
    const display = getBookingServicesByRoom(
      {
        roomId: "103, 202",
        roomSetupByRoom: { "103": "103_LAYOUT_0", "202": "no" },
        setupDetailsByRoom: { "202": "none" },
        cateringByRoom: { "202": "no" },
        hireSecurity: "none",
      },
      [screeningRoom, garage],
    );

    expect(hasBookingServicesDisplay(display)).toBe(false);
    expect(display.rooms).toEqual([]);
  });

  it("shows a requested setup option label and skips the room id prefix", () => {
    const display = getBookingServicesByRoom(
      {
        roomId: "103",
        roomSetupByRoom: { "103": "103_LAYOUT_1" },
        chartFieldForRoomSetupByRoom: { "103": "cbs-1" },
      },
      [garage],
    );

    expect(display.rooms[0].rows).toEqual([
      {
        key: "setup",
        label: "Room Setup",
        value: "Audience Layout 1 - 44 Seated*",
        chartField: "cbs-1",
      },
    ]);
  });

  it("shows equipment details on the room that requested them", () => {
    const display = getBookingServicesByRoom({
      roomId: "202",
      equipmentServices: "",
      equipmentServicesDetails: "2x SM58 microphones",
      equipmentServicesDetailsByRoom: { "230": "2x SM58 microphones" },
    });

    expect(display.rooms.map((room) => room.roomId)).toEqual(["230"]);
    expect(display.rooms[0].rows).toEqual([
      { key: "equipment", label: "Equipment", value: "2x SM58 microphones" },
    ]);
  });

  it("attributes legacy scalars to a single booked room", () => {
    const display = getBookingServicesByRoom({
      roomId: "202",
      roomSetup: "Standard",
      catering: "yes",
      chartFieldForCatering: "cat-1",
      hireSecurity: "willoughby",
    });

    expect(display.bookingLevel).toEqual([]);
    expect(display.rooms).toHaveLength(1);
    expect(display.rooms[0].title).toBe("202");
    expect(display.rooms[0].rows.map((row) => row.key)).toEqual([
      "setup",
      "catering",
      "security",
    ]);
    expect(display.rooms[0].rows.find((row) => row.key === "setup")?.value).toBe(
      "Standard",
    );
    expect(display.rooms[0].rows.find((row) => row.key === "security")?.value).toBe(
      "Willoughby entrance",
    );
  });

  it("fans legacy catering and security onto rooms that offer those services", () => {
    const display = getBookingServicesByRoom(
      {
        roomId: "202, 103",
        catering: "yes",
        chartFieldForCatering: "cat-1",
        hireSecurity: "willoughby",
      },
      [screeningRoom, garage],
    );

    expect(display.bookingLevel).toEqual([]);
    expect(display.rooms.map((room) => room.roomId)).toEqual(["202", "103"]);
    expect(display.rooms[0].rows).toEqual([
      { key: "catering", label: "Catering", value: "Yes", chartField: "cat-1" },
    ]);
    expect(display.rooms[1].rows).toEqual([
      {
        key: "security",
        label: "Campus Safety",
        value: "Willoughby Street Entrance",
      },
    ]);
  });

  it("shows multi-room setup, equipment, and staffing once at booking level", () => {
    const staffingRoom: ServiceResourceLike = {
      resourceId: "202",
      name: "Screening Room",
      services: {
        staffing: { label: "Staffing" },
        catering: { label: "Catering?", toggle: "optional" },
      },
    };
    const display = getBookingServicesByRoom(
      {
        roomId: "202, 103",
        roomSetup: "Standard",
        equipmentServicesDetails: "2x SM58 microphones",
        staffingServices: "AUDIO_TECH_103",
        staffingServicesDetails: "Need an A1",
        catering: "yes",
      },
      [staffingRoom, garage],
    );

    expect(display.bookingLevel.map((row) => row.key)).toEqual([
      "setup",
      "equipment",
    ]);
    expect(display.bookingLevel.find((row) => row.key === "setup")?.value).toBe(
      "Standard",
    );
    expect(
      display.bookingLevel.find((row) => row.key === "equipment")?.value,
    ).toBe("2x SM58 microphones");
    expect(display.rooms.map((room) => room.roomId)).toEqual(["202", "103"]);
    expect(display.rooms[0].rows.map((row) => row.key)).toEqual([
      "staffing",
      "catering",
    ]);
    expect(display.rooms[1].rows.map((row) => row.key)).toEqual(["staffing"]);
    expect(display.rooms[0].rows.find((row) => row.key === "staffing")?.value).toContain(
      "Need an A1",
    );
  });

  it("keeps legacy catering at booking level when no room offers that service", () => {
    const display = getBookingServicesByRoom({
      roomId: "202, 103",
      catering: "yes",
      chartFieldForCatering: "cat-1",
      hireSecurity: "willoughby",
    });

    expect(display.rooms).toEqual([]);
    expect(display.bookingLevel.map((row) => row.key)).toEqual([
      "catering",
      "security",
    ]);
    expect(display.bookingLevel[0]).toMatchObject({
      value: "Yes",
      chartField: "cat-1",
    });
  });

  it("shows annex selections under the parent room without a roomId prefix", () => {
    const display = getBookingServicesByRoom(
      {
        roomId: "103",
        annexByRoom: { "103": ["202GR"] },
      },
      [
        garage,
        {
          resourceId: "202GR",
          name: "Garage Green Room",
          parentResourceId: "103",
        },
      ],
    );

    expect(display.rooms[0].rows).toEqual([
      {
        key: "annex",
        label: "Auxiliary Spaces",
        value: "202GR Garage Green Room",
      },
    ]);
  });

  it("shows staffing and media on every booked room", () => {
    const staffingRoom: ServiceResourceLike = {
      resourceId: "202",
      name: "Screening Room",
      services: { staffing: { label: "Staffing" } },
    };
    const display = getBookingServicesByRoom(
      {
        roomId: "103, 202",
        staffingServices: "AUDIO_TECH_103",
        staffingServicesDetails: "Need an A1",
        mediaServices: "Checkout Equipment",
      },
      [garage, staffingRoom],
    );

    expect(display.bookingLevel).toEqual([]);
    expect(display.rooms.map((room) => room.roomId)).toEqual(["103", "202"]);
    expect(display.rooms[0].rows.map((row) => row.key)).toEqual([
      "staffing",
      "media",
    ]);
    expect(display.rooms[1].rows.map((row) => row.key)).toEqual([
      "staffing",
      "media",
    ]);
    expect(display.rooms[0].rows[0].value).toContain("Need an A1");
    expect(display.rooms[0].rows[1].value).toBe("Checkout Equipment");
  });

  it("does not repeat Checkout Equipment as media when equipment already has it", () => {
    const display = getBookingServicesByRoom({
      roomId: "202, 103",
      equipmentServices: "Checkout Equipment",
      mediaServices: "Checkout Equipment",
    });

    expect(display.bookingLevel.map((row) => row.key)).toEqual(["equipment"]);
    expect(display.bookingLevel[0].value).toBe("Checkout Equipment");
    expect(display.rooms).toEqual([]);
  });

  it("keeps media options that are not already shown as equipment", () => {
    const display = getBookingServicesByRoom({
      roomId: "202, 103",
      equipmentServices: "Checkout Equipment",
      mediaServices:
        "Checkout Equipment, (Garage 103) Request an audio technician",
    });

    expect(display.bookingLevel.map((row) => row.key)).toEqual(["equipment"]);
    expect(display.rooms).toHaveLength(2);
    expect(display.rooms[0].rows).toEqual([
      {
        key: "media",
        label: "Media Service",
        value: "(Garage 103) Request an audio technician",
      },
    ]);
  });
});

describe("formatServicesDescriptionHtml", () => {
  it("renders booking-level rows then a heading and list per room", () => {
    const html = formatServicesDescriptionHtml({
      bookingLevel: [
        { key: "setup", label: "Room Setup", value: "Standard" },
      ],
      rooms: [
        {
          roomId: "202",
          title: "202 Screening Room",
          rows: [
            {
              key: "catering",
              label: "Catering",
              value: "Yes",
              chartField: "123-456",
            },
          ],
        },
      ],
    });

    expect(html).toContain("<h3>Services</h3>");
    expect(html).toContain("<strong>Room Setup:</strong> Standard");
    expect(html).toContain("<h4>202 Screening Room</h4>");
    expect(html).toContain("<strong>Catering:</strong> Yes<br>123-456");
  });

  it("returns an empty string when nothing was requested", () => {
    expect(
      formatServicesDescriptionHtml({ bookingLevel: [], rooms: [] }),
    ).toBe("");
  });
});
