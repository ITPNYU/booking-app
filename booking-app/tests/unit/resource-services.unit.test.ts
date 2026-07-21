import { describe, expect, it } from "vitest";
import { getMediaCommonsServices } from "@/components/src/utils/tenantUtils";
import {
  anyRoomHasVisibleService,
  getRoomsWithVisibleService,
} from "@/components/src/utils/resourceServicesUtils";
import {
  applyMcResourceServices,
  getMcResourceServices,
  MC_RESOURCE_SERVICES_103,
} from "@/lib/tenant/mcResourceServices";
import { migrateResourceServices } from "@/lib/tenant/migrateResourceServices";

describe("getMediaCommonsServices", () => {
  it("requests security for yes hireSecurity", () => {
    const services = getMediaCommonsServices({
      hireSecurity: "yes",
    });
    expect(services.security).toBe(true);
  });

  it("does not request security when hireSecurity is empty", () => {
    const services = getMediaCommonsServices({
      hireSecurity: "",
    });
    expect(services.security).toBe(false);
  });

  it("detects setup from per-room maps", () => {
    const services = getMediaCommonsServices({
      roomSetupByRoom: { "1201": "1201_LAYOUT_1" },
    });
    expect(services.setup).toBe(true);
  });

  it("detects auxiliary from lounge or auxiliary flags", () => {
    expect(
      getMediaCommonsServices({ auxiliarySpaceRequested: true }).auxiliary,
    ).toBe(true);
    expect(
      getMediaCommonsServices({
        studentLoungeByRoom: { "202": "yes" },
      }).auxiliary,
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

  it("hides VIP-only sections from standard user and walk-in", () => {
    const rooms = [
      {
        roomId: "220",
        services: {
          catering: {
            showInOrigin: { user: false, walkIn: false, VIP: true },
            label: "Catering?",
            chartField: { required: true },
          },
        },
      },
    ];
    expect(anyRoomHasVisibleService(rooms, "catering", standardUser)).toBe(false);
    expect(anyRoomHasVisibleService(rooms, "catering", walkInUser)).toBe(false);
    expect(anyRoomHasVisibleService(rooms, "catering", vipUser)).toBe(true);
  });
});

describe("applyMcResourceServices", () => {
  it("applies MC defaults for legacy resources without object config", () => {
    const result = applyMcResourceServices({
      resourceId: "202",
      name: "202",
      capacity: 50,
      services: ["catering"],
    });
    expect(result.services?.catering?.forceCleaning).toBe(true);
    expect(result.services?.catering?.chartField?.required).toBe(true);
    expect(result.services?.setup?.mode).toBe("static");
    expect(result.services?.annex?.mode).toBe("radio");
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

  it("includes room 260 defaults", () => {
    expect(getMcResourceServices("260")?.setup?.defaultValue).toBe(
      "260_LAYOUT_0",
    );
    expect(getMcResourceServices("260")?.catering?.showInOrigin?.user).toBe(
      false,
    );
  });

  it("uses switch security for 103 (no entrance radio)", () => {
    expect(MC_RESOURCE_SERVICES_103.security?.mode).toBeUndefined();
    expect(MC_RESOURCE_SERVICES_103.security?.chartField?.required).toBe(true);
    expect(MC_RESOURCE_SERVICES_103.security?.options).toBeUndefined();
  });
});

describe("migrateResourceServices", () => {
  it("converts legacy services array to object stubs", () => {
    const result = migrateResourceServices({
      services: ["equipment", "catering", "setup"],
    });
    expect(result.equipment?.mode).toBeUndefined();
    expect(result.equipment?.label).toBe("Equipment");
    expect(result.catering?.forceCleaning).toBe(true);
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
});
