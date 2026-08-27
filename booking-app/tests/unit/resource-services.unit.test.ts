import { describe, expect, it } from "vitest";
import { getMediaCommonsServices } from "@/components/src/utils/tenantUtils";
import {
  anyRoomHasVisibleService,
  formatAnnexByRoomForDisplay,
  getAnnexOptions,
  getRoomsWithVisibleService,
  getStaffingServiceLabel,
  isPassiveSetupSelection,
  mergeRoomIdsWithAnnex,
  resolveAnnexCalendarIds,
} from "@/components/src/utils/resourceServicesUtils";

/** MC rooms as stored in the tenant schema (services snapshot fixture). */
const mcRooms = Object.entries(MC_TEST_RESOURCE_SERVICES).map(
  ([resourceId, services]) => ({ resourceId, services }),
);
const svc = (data: any) => getMediaCommonsServices(data, mcRooms);
import { MC_TEST_RESOURCE_SERVICES } from "@/components/src/testHelpers/mcResourceServicesFixture";
import { migrateResourceServices } from "@/lib/tenant/migrateResourceServices";

describe("getMediaCommonsServices", () => {
  it("requests security for yes hireSecurity", () => {
    const services = svc({
      hireSecurity: "yes",
    });
    expect(services.security).toBe(true);
  });

  it("requests security for custom radio values", () => {
    expect(
      svc({ hireSecurity: "willoughby" }).security,
    ).toBe(true);
    expect(
      svc({ hireSecurity: "main_entrance" }).security,
    ).toBe(true);
  });

  it("does not request security when hireSecurity is empty or no", () => {
    expect(svc({ hireSecurity: "" }).security).toBe(false);
    expect(svc({ hireSecurity: "no" }).security).toBe(
      false,
    );
    expect(svc({ hireSecurity: "No" }).security).toBe(
      false,
    );
  });

  it("does not treat capitalized No as setup requested", () => {
    expect(svc({ roomSetup: "No" }).setup).toBe(false);
    expect(svc({ roomSetup: "no" }).setup).toBe(false);
  });

  it("does not treat passive default layouts as setup requested", () => {
    expect(
      svc({
        roomSetupByRoom: { "1201": "1201_LAYOUT_0" },
        roomSetup: "yes",
        setupDetails: "Lecture Style (Default) - 84 Seated",
      }).setup,
    ).toBe(false);
    expect(
      svc({
        roomSetupByRoom: { "103": "103_LAYOUT_0" },
      }).setup,
    ).toBe(false);
    expect(
      svc({
        roomSetupByRoom: { "202": "202_LAYOUT_0" },
      }).setup,
    ).toBe(false);
  });

  it("treats non-default layouts as setup requested", () => {
    expect(
      svc({
        roomSetupByRoom: { "1201": "1201_LAYOUT_1" },
      }).setup,
    ).toBe(true);
    expect(
      svc({
        roomSetupByRoom: { "202": "202_LAYOUT_1" },
      }).setup,
    ).toBe(true);
    expect(
      svc({
        roomSetupByRoom: { "233": "233_LAYOUT_0" },
      }).setup,
    ).toBe(true);
  });

  it("detects setup from per-room maps", () => {
    const services = svc({
      roomSetupByRoom: { "1201": "1201_LAYOUT_1" },
    });
    expect(services.setup).toBe(true);
  });

  it("treats additional event furniture as setup requested", () => {
    expect(
      svc({
        furnishingsByRoom: { "103": "yes" },
      }).setup,
    ).toBe(true);
    expect(
      svc({
        furnishingsByRoom: { "103": "no" },
      }).setup,
    ).toBe(false);
  });

  it("still detects legacy setup when by-room maps are also present", () => {
    expect(
      svc({
        roomSetupByRoom: { "103": "103_LAYOUT_0" },
        roomSetup: "custom",
        setupDetails: "Need extra tables for the adjacent room",
      }).setup,
    ).toBe(true);
  });
});

describe("resource service visibility", () => {
  const standardUser = { isVIP: false, isWalkIn: false, isStandardUser: true };
  const walkInUser = { isVIP: false, isWalkIn: true, isStandardUser: false };
  const vipUser = { isVIP: true, isWalkIn: false, isStandardUser: false };

  it("shows legacy string[] services when no object config exists", () => {
    const rooms = [{ roomId: "room1", services: ["catering", "equipment"] }];
    expect(anyRoomHasVisibleService(rooms, "catering", standardUser)).toBe(true);
    expect(getRoomsWithVisibleService(rooms, "equipment", standardUser)).toHaveLength(
      1,
    );
  });

  it("shows staffing for object configs using showInOrigin", () => {
    const rooms = [
      {
        roomId: "103",
        services: {
          staffing: {
            showInOrigin: { user: true, walkIn: true, VIP: true },
            label: "Staffing?",
            sections: {
              lighting: {
                label: "Lighting",
                mode: "radio" as const,
                options: [{ value: "DIY", label: "DIY" }],
              },
            },
          },
        },
      },
    ];
    expect(anyRoomHasVisibleService(rooms, "staffing", standardUser)).toBe(true);
    expect(getRoomsWithVisibleService(rooms, "staffing", standardUser)).toHaveLength(
      1,
    );
  });

  it("hides VIP-only sections from standard user but shows walk-in", () => {
    const rooms = [
      {
        roomId: "220",
        services: {
          catering: {
            showInOrigin: { user: false, walkIn: true, VIP: true },
            label: "Catering?",
            chartField: { required: true },
          },
        },
      },
    ];
    expect(anyRoomHasVisibleService(rooms, "catering", standardUser)).toBe(false);
    expect(anyRoomHasVisibleService(rooms, "catering", walkInUser)).toBe(true);
    expect(anyRoomHasVisibleService(rooms, "catering", vipUser)).toBe(true);
  });
});

describe("schema-driven MC helpers", () => {
  it("resolves staffing option values to labels from tenant resources", () => {
    expect(getStaffingServiceLabel(mcRooms, "LIGHTING_TECH_DIY")).toBe(
      "DIY - Basic Washes",
    );
    expect(getStaffingServiceLabel(mcRooms, "AUDIO_TECH_DIY")).toBe(
      "DIY - Plug & Play",
    );
    expect(getStaffingServiceLabel(mcRooms, "AUDIO_TECH_A1")).toBe(
      "Audio Tech - A1",
    );
    expect(getStaffingServiceLabel(mcRooms, "UNKNOWN_VALUE")).toBe(
      "UNKNOWN_VALUE",
    );
    expect(getStaffingServiceLabel([], "AUDIO_TECH_A1")).toBe("AUDIO_TECH_A1");
  });

  it("treats default layouts without a chartfield as passive", () => {
    expect(isPassiveSetupSelection(mcRooms, "1201_LAYOUT_0")).toBe(true);
    expect(
      isPassiveSetupSelection(mcRooms, "Lecture Style (Default) - 84 Seated"),
    ).toBe(true);
    expect(isPassiveSetupSelection(mcRooms, "1201_LAYOUT_1")).toBe(false);
    // Room 230's default carries a chartfield, so it is an active request.
    expect(isPassiveSetupSelection(mcRooms, "230_LAYOUT_CUSTOM")).toBe(false);
    expect(isPassiveSetupSelection([], "1201_LAYOUT_0")).toBe(false);
  });

  it("counts a default layout as a setup request when no resources are known", () => {
    expect(
      getMediaCommonsServices(
        { roomSetupByRoom: { "1201": "1201_LAYOUT_0" } },
        [],
      ).setup,
    ).toBe(true);
  });
});

describe("migrateResourceServices", () => {
  it("converts legacy services array to object stubs", () => {
    const result = migrateResourceServices({
      services: ["equipment", "catering", "setup"],
    });
    expect(result.equipment?.mode).toBeUndefined();
    expect(result.equipment?.label).toBe("Equipment");
    expect(result.catering?.forceCleaning).toBeUndefined();
    expect(result.catering?.label).toBe("Catering");
    expect(result.setup?.label).toBe("Room Setup");
  });

  it("merges staffing sections from legacy arrays", () => {
    const result = migrateResourceServices({
      services: ["staffing"],
      staffingServices: ["LIGHTING_TECH_103", "AUDIO_TECH_103"],
      staffingSections: [
        { name: "Lighting", indexes: [0] },
        { name: "Audio", indexes: [1] },
      ],
    });
    expect(result.staffing?.sections?.["0_lighting"]?.options[0].value).toBe(
      "LIGHTING_TECH_103",
    );
    expect(result.staffing?.sections?.["1_audio"]?.options[0].value).toBe(
      "AUDIO_TECH_103",
    );
  });

  it("normalizes select/requiresChartField into radio/chartField", () => {
    const result = migrateResourceServices({
      services: {
        setup: {
          mode: "select",
          options: [
            { value: "a", label: "A", requiresChartField: true },
          ],
        },
        auxiliarySpace: { enabled: true, label: "Green room" },
      },
    });
    expect(result.setup?.mode).toBe("radio");
    expect(result.setup?.options?.[0].chartField?.required).toBe(true);
    expect(result.annex?.label).toBe("Green room");
  });

  it("coerces lowercase chartfield and infers static for description-only", () => {
    const result = migrateResourceServices({
      services: {
        setup: {
          label: "Room Setup?",
          descriptionHtml: "<p>No options</p>",
        },
        furnishings: {
          label: "Furniture?",
          chartfield: {
            label: "Chartfield",
            required: true,
            validation: "CHARTFIELD_REGEX",
          },
        },
        staffing: {
          label: "Staffing?",
          descriptionHtml: "<p>There are no staffing options</p>",
        },
      },
    });
    expect(result.setup?.mode).toBe("static");
    expect(result.furnishings?.mode).toBeUndefined();
    expect(result.furnishings?.chartField?.required).toBe(true);
    expect(result.furnishings?.chartField?.validation).toBe("CHARTFIELD_REGEX");
    expect(result.staffing?.mode).toBe("static");
    expect(result.staffing?.sections).toBeUndefined();
  });

  it("preserves staffing mode hidden when there are no sections", () => {
    const result = migrateResourceServices({
      services: {
        staffing: {
          label: "Staffing?",
          mode: "hidden",
          descriptionHtml: "<p>Hidden staffing</p>",
        },
      },
    });
    expect(result.staffing?.mode).toBe("hidden");
    expect(result.staffing?.sections).toBeUndefined();
  });

  it("preserves option descriptionHtml and required", () => {
    const result = migrateResourceServices({
      services: {
        setup: {
          mode: "radio",
          options: [
            {
              value: "custom",
              label: "Custom Room Setup",
              descriptionHtml: "Please describe the layout in detail.",
              required: false,
            },
          ],
        },
      },
    });
    expect(result.setup?.options?.[0].descriptionHtml).toBe(
      "Please describe the layout in detail.",
    );
    expect(result.setup?.options?.[0].required).toBe(false);
  });
});

describe("formatAnnexByRoomForDisplay", () => {
  it("resolves labels from annex child resources", () => {
    const parent = { resourceId: "1201", name: "Seminar Room", services: {} };
    const children = [
      {
        resourceId: "1200L-6",
        name: "Seminar Foyer",
        parentResourceId: "1201",
        services: {},
      },
      {
        resourceId: "1204",
        name: "Seminar Lounge",
        parentResourceId: "1201",
        services: {},
      },
    ];
    expect(
      formatAnnexByRoomForDisplay({ "1201": ["1200L-6", "1204"] }, [
        parent,
        ...children,
      ]),
    ).toBe("1201: 1200L-6 Seminar Foyer, 1204 Seminar Lounge");
  });

  it("falls back to configured option labels without child resources", () => {
    const room = {
      resourceId: "1201",
      name: "Seminar Room",
      services: {
        annex: {
          mode: "checkbox" as const,
          options: [{ value: "1204", label: "1204 Seminar Lounge" }],
        },
      },
    };
    expect(formatAnnexByRoomForDisplay({ "1201": ["1204"] }, [room])).toBe(
      "1201: 1204 Seminar Lounge",
    );
  });

  it("prefers annex resource names over configured option labels", () => {
    const parent = {
      resourceId: "1201",
      name: "Seminar Room",
      services: {
        annex: {
          mode: "checkbox" as const,
          options: [{ value: "1204", label: "Old Label" }],
        },
      },
    };
    const child = {
      resourceId: "1204",
      name: "Renamed Lounge",
      parentResourceId: "1201",
      services: {},
    };
    expect(
      formatAnnexByRoomForDisplay({ "1201": ["1204"] }, [parent, child]),
    ).toBe("1201: 1204 Renamed Lounge");
  });
});

describe("annex parent-child resources", () => {
  const parent = {
    resourceId: "1201",
    name: "Seminar Room",
    services: {
      annex: {
        mode: "checkbox" as const,
        options: [{ value: "9999", label: "Legacy Fallback Space" }],
      },
    },
  };
  const children = [
    {
      resourceId: "1204",
      name: "Seminar Lounge",
      parentResourceId: "1201",
      calendarId: "cal-1204@group.calendar.google.com",
      services: {},
    },
    {
      resourceId: "1200L-6",
      name: "Seminar Foyer",
      parentResourceId: "1201",
      calendarId: "cal-1200l6@group.calendar.google.com",
      services: {},
    },
  ];
  const topLevel = {
    resourceId: "103",
    name: "The Garage",
    calendarId: "cal-103@group.calendar.google.com",
    services: {},
  };

  it("derives annex options from child resources, sorted by id", () => {
    const options = getAnnexOptions(parent, [parent, topLevel, ...children]);
    expect(options).toEqual([
      { value: "1200L-6", label: "1200L-6 Seminar Foyer" },
      { value: "1204", label: "1204 Seminar Lounge" },
    ]);
  });

  it("falls back to configured options when no child resources exist", () => {
    expect(getAnnexOptions(parent, [parent, topLevel])).toEqual([
      { value: "9999", label: "Legacy Fallback Space" },
    ]);
    expect(getAnnexOptions(parent)).toEqual([
      { value: "9999", label: "Legacy Fallback Space" },
    ]);
  });

  it("resolves selected annex values to child calendar IDs", () => {
    const resources = [parent, topLevel, ...children];
    expect(
      resolveAnnexCalendarIds({ "1201": ["1204", "1200L-6"] }, resources),
    ).toEqual([
      "cal-1204@group.calendar.google.com",
      "cal-1200l6@group.calendar.google.com",
    ]);
  });

  it("ignores values without a registered annex resource", () => {
    const resources = [parent, topLevel, ...children];
    // "9999" is a legacy option with no resource; "103" is a top-level room,
    // which must never be invited via the annex path.
    expect(
      resolveAnnexCalendarIds({ "1201": ["9999", "103"] }, resources),
    ).toEqual([]);
    expect(resolveAnnexCalendarIds(undefined, resources)).toEqual([]);
  });

  it("merges annex ids into the room list in numeric order", () => {
    expect(
      mergeRoomIdsWithAnnex("202, 1201", {
        "202": ["202GR", "205"],
        "1201": ["1204"],
      }),
    ).toBe("202, 202GR, 205, 1201, 1204");
    expect(mergeRoomIdsWithAnnex("202, 1201", undefined)).toBe("202, 1201");
    expect(mergeRoomIdsWithAnnex("202", { "202": ["202"] })).toBe("202");
    expect(mergeRoomIdsWithAnnex(undefined, undefined)).toBe("");
  });

  it("dedupes calendar IDs across parents", () => {
    const resources = [parent, topLevel, ...children];
    expect(
      resolveAnnexCalendarIds(
        { "1201": ["1204"], "202": ["1204"] },
        resources,
      ),
    ).toEqual(["cal-1204@group.calendar.google.com"]);
  });
});
