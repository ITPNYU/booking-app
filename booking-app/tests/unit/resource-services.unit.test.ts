import { describe, expect, it } from "vitest";
import { getMediaCommonsServices } from "@/components/src/utils/tenantUtils";
import {
  anyRoomHasVisibleService,
  getRoomsWithVisibleService,
} from "@/components/src/utils/resourceServicesUtils";
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

describe("migrateResourceServices", () => {
  it("converts legacy services array to object stubs", () => {
    const result = migrateResourceServices({
      services: ["equipment", "catering", "setup"],
    });
    expect(result.equipment?.mode).toBe("toggle");
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
    expect(result.staffing?.sections?.lighting?.services[0].value).toBe(
      "LIGHTING_TECH_103",
    );
    expect(result.staffing?.sections?.audio?.services[0].value).toBe(
      "AUDIO_TECH_103",
    );
  });
});
