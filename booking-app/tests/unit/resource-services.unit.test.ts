import { describe, expect, it } from "vitest";
import { getMediaCommonsServices } from "@/components/src/utils/tenantUtils";
import {
  anyRoomHasVisibleService,
  getRoomsWithVisibleService,
} from "@/components/src/utils/resourceServicesUtils";
import { applyMcResourceServices } from "@/lib/tenant/mcResourceServices";
import { migrateResourceServices } from "@/lib/tenant/migrateResourceServices";

describe("getMediaCommonsServices", () => {
  it("does not request security for 103 main entrance choice", () => {
    const services = getMediaCommonsServices({
      hireSecurity: "main_entrance",
    });
    expect(services.security).toBe(false);
  });

  it("requests security for willoughby entrance", () => {
    const services = getMediaCommonsServices({
      hireSecurity: "willoughby",
    });
    expect(services.security).toBe(true);
  });

  it("detects setup from per-room maps", () => {
    const services = getMediaCommonsServices({
      roomSetupByRoom: { "1201": "classroom_style" },
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

  it("shows legacy string[] services when no object config exists", () => {
    const rooms = [{ roomId: "room1", services: ["catering", "equipment"] }];
    expect(anyRoomHasVisibleService(rooms, "catering", standardUser)).toBe(true);
    expect(getRoomsWithVisibleService(rooms, "equipment", standardUser)).toHaveLength(
      1,
    );
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
    expect(result.services?.catering?.mode).toBe("static");
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
});
