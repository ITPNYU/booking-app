import { describe, expect, it } from "vitest";
import { getMediaCommonsServices } from "@/components/src/utils/tenantUtils";
import {
  anyRoomHasVisibleService,
  getRoomsWithVisibleService,
} from "@/components/src/utils/resourceServicesUtils";
import {
  applyMcResourceServices,
  getMcResourceServices,
} from "@/lib/tenant/mcResourceServices";
import { migrateResourceServices } from "@/lib/tenant/migrateResourceServices";

describe("getMediaCommonsServices", () => {
  it("requests security for yes hireSecurity", () => {
    const services = getMediaCommonsServices({
      hireSecurity: "yes",
    });
    expect(services.security).toBe(true);
  });

  it("requests security for custom radio values", () => {
    expect(
      getMediaCommonsServices({ hireSecurity: "willoughby" }).security,
    ).toBe(true);
    expect(
      getMediaCommonsServices({ hireSecurity: "main_entrance" }).security,
    ).toBe(true);
  });

  it("does not request security when hireSecurity is empty or no", () => {
    expect(getMediaCommonsServices({ hireSecurity: "" }).security).toBe(false);
    expect(getMediaCommonsServices({ hireSecurity: "no" }).security).toBe(
      false,
    );
    expect(getMediaCommonsServices({ hireSecurity: "No" }).security).toBe(
      false,
    );
  });

  it("does not treat capitalized No as setup requested", () => {
    expect(getMediaCommonsServices({ roomSetup: "No" }).setup).toBe(false);
    expect(getMediaCommonsServices({ roomSetup: "no" }).setup).toBe(false);
  });

  it("does not treat passive default layouts as setup requested", () => {
    expect(
      getMediaCommonsServices({
        roomSetupByRoom: { "1201": "1201_LAYOUT_0" },
        roomSetup: "yes",
        setupDetails: "Lecture Style (Default) - 84 Seated",
      }).setup,
    ).toBe(false);
    expect(
      getMediaCommonsServices({
        roomSetupByRoom: { "103": "103_LAYOUT_0" },
      }).setup,
    ).toBe(false);
    expect(
      getMediaCommonsServices({
        roomSetupByRoom: { "202": "202_LAYOUT_0" },
      }).setup,
    ).toBe(false);
  });

  it("treats non-default layouts as setup requested", () => {
    expect(
      getMediaCommonsServices({
        roomSetupByRoom: { "1201": "1201_LAYOUT_1" },
      }).setup,
    ).toBe(true);
    expect(
      getMediaCommonsServices({
        roomSetupByRoom: { "202": "202_LAYOUT_1" },
      }).setup,
    ).toBe(true);
    expect(
      getMediaCommonsServices({
        roomSetupByRoom: { "233": "233_LAYOUT_0" },
      }).setup,
    ).toBe(true);
  });

  it("detects setup from per-room maps", () => {
    const services = getMediaCommonsServices({
      roomSetupByRoom: { "1201": "1201_LAYOUT_1" },
    });
    expect(services.setup).toBe(true);
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

describe("applyMcResourceServices", () => {
  it("applies MC defaults when services are missing or a legacy array", () => {
    const missing = applyMcResourceServices({
      resourceId: "202",
      name: "202",
      capacity: 50,
    });
    expect(missing.services?.catering?.forceCleaning).toBe(true);
    expect(missing.services?.catering?.chartField?.required).toBe(true);
    expect(missing.services?.setup?.mode).toBe("radio");
    expect(missing.services?.setup?.defaultValue).toBe("202_LAYOUT_0");
    expect(missing.services?.annex?.options?.length).toBe(2);

    const emptyArray = applyMcResourceServices({
      resourceId: "202",
      name: "202",
      capacity: 50,
      services: [],
    });
    expect(emptyArray.services?.setup?.mode).toBe("radio");
  });

  it("replaces legacy services arrays with MC room defaults", () => {
    const legacy = ["equipment", "catering"];
    const result = applyMcResourceServices({
      resourceId: "202",
      name: "202",
      capacity: 50,
      services: legacy,
    });
    expect(Array.isArray(result.services)).toBe(false);
    expect(result.services?.catering?.forceCleaning).toBe(true);
    expect(result.services?.setup?.mode).toBe("radio");
  });

  it("does not overwrite an existing object services config", () => {
    const custom = {
      catering: { label: "Custom Catering" },
    };
    const result = applyMcResourceServices({
      resourceId: "202",
      name: "202",
      capacity: 50,
      services: custom,
    });
    expect(result.services).toEqual(custom);
  });

  it("preserves intentional empty object services configs", () => {
    const result = applyMcResourceServices({
      resourceId: "202",
      name: "202",
      capacity: 50,
      services: {},
    });
    expect(result.services).toEqual({});
  });

  it("uses empty config for room 260", () => {
    expect(getMcResourceServices("260")).toEqual({});
  });

  it("uses checkbox security for 103 with Willoughby entrance option", () => {
    const services103 = getMcResourceServices("103")!;
    expect(services103.security?.mode).toBe("checkbox");
    expect(services103.security?.required).toBeUndefined();
    expect(services103.security?.defaultValue).toBeUndefined();
    expect(services103.security?.options?.[0]?.value).toBe(
      "Willoughby Street Entrance",
    );
    expect(
      services103.security?.options?.[0]?.chartField?.required,
    ).toBe(true);
  });

  it("uses VIP-only setup and custom layout option for room 202", () => {
    const setup202 = getMcResourceServices("202")!.setup!;
    expect(setup202.showInOrigin).toEqual({
      user: false,
      walkIn: false,
      VIP: true,
    });
    expect(setup202.defaultValue).toBe("202_LAYOUT_0");
    expect(setup202.options?.map((o) => o.value)).toEqual([
      "202_LAYOUT_0",
      "202_LAYOUT_1",
    ]);
  });

  it("uses numbered layout options for room 233", () => {
    const setup233 = getMcResourceServices("233")!.setup!;
    expect(setup233.defaultValue).toBe("233_LAYOUT_0");
    expect(setup233.options?.[0]).toMatchObject({
      value: "233_LAYOUT_0",
      label: "Classroom Style - 72 Seated",
    });
    expect(setup233.options?.map((o) => o.value)).toEqual([
      "233_LAYOUT_0",
      "233_LAYOUT_1",
      "233_LAYOUT_2",
      "233_LAYOUT_3",
    ]);
  });

  it("uses custom setup radio for ballroom rooms", () => {
    expect(getMcResourceServices("220")?.setup?.defaultValue).toBe(
      "220_LAYOUT_CUSTOM",
    );
    expect(
      getMcResourceServices("220")?.setup?.options?.[0]?.descriptionHtml,
    ).toBe("Please describe the layout in detail.");
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
