import { describe, expect, it } from "vitest";
import { BookingOrigin, FormContextLevel } from "@/components/src/types";
import {
  getRequestOrigin,
  getServiceSectionFlags,
  hasAnyServiceSection,
} from "@/components/src/utils/serviceSections";
import { getRoomsWithAnyVisibleService } from "@/components/src/utils/resourceServicesUtils";

const standardUser = { isVIP: false, isWalkIn: false, isStandardUser: true };
const walkIn = { isVIP: false, isWalkIn: true, isStandardUser: false };

const legacyCateringRoom = { roomId: "101", services: ["catering"] };
const legacyEquipmentRoom = { roomId: "102", services: ["equipment"] };
const noServicesRoom = { roomId: "103" };
const emptySchemaRoom = { roomId: "104", services: {} };
const schemaCateringRoom = {
  roomId: "105",
  services: {
    catering: { label: "Catering", chartField: { required: true } },
  },
};
const schemaEquipmentRoom = {
  roomId: "106",
  services: { equipment: { label: "Equipment", toggle: "optional" as const } },
};
const hiddenSectionRoom = {
  roomId: "107",
  services: { catering: { label: "Catering", mode: "hidden" as const } },
};

describe("getRoomsWithAnyVisibleService", () => {
  it("keeps rooms with at least one section the origin can see", () => {
    expect(
      getRoomsWithAnyVisibleService(
        [
          schemaCateringRoom,
          emptySchemaRoom,
          hiddenSectionRoom,
          noServicesRoom,
        ],
        standardUser,
      ),
    ).toEqual([schemaCateringRoom]);
  });

  it("ignores the annex section, which lives on the room page", () => {
    const annexOnly = {
      roomId: "108",
      services: {
        annex: { label: "Annex", mode: "checkbox" as const, options: [] },
      },
    };
    expect(getRoomsWithAnyVisibleService([annexOnly], standardUser)).toEqual(
      [],
    );
  });
});

describe("getServiceSectionFlags", () => {
  it("shows the legacy catering switch for a legacy room", () => {
    const flags = getServiceSectionFlags(
      [legacyCateringRoom],
      standardUser,
      false,
    );
    expect(flags.schemaDrivenServices).toBe(false);
    expect(flags.showLegacyCatering).toBe(true);
    expect(flags.showSchemaSections).toBe(false);
    expect(hasAnyServiceSection(flags)).toBe(true);
  });

  it("shows nothing for a room with an empty services config", () => {
    const flags = getServiceSectionFlags([emptySchemaRoom], standardUser, true);
    expect(flags.schemaDrivenServices).toBe(true);
    expect(flags.showGenericSetup).toBe(false);
    expect(flags.showSchemaSections).toBe(false);
    expect(hasAnyServiceSection(flags)).toBe(false);
  });

  it("offers the generic setup switch to a room without services only when the tenant shows setup", () => {
    expect(
      hasAnyServiceSection(
        getServiceSectionFlags([noServicesRoom], standardUser, true),
      ),
    ).toBe(true);
    expect(
      hasAnyServiceSection(
        getServiceSectionFlags([noServicesRoom], standardUser, false),
      ),
    ).toBe(false);
  });

  it("renders schema rooms through the per-room sections, not the legacy switches", () => {
    const flags = getServiceSectionFlags(
      [schemaCateringRoom],
      standardUser,
      true,
    );
    expect(flags.showSchemaSections).toBe(true);
    expect(flags.showLegacyCatering).toBe(false);
    expect(flags.showGenericSetup).toBe(false);
    expect(hasAnyServiceSection(flags)).toBe(true);
  });

  it("uses the legacy equipment UI only for sections the schema form does not render", () => {
    expect(
      getServiceSectionFlags([legacyEquipmentRoom], standardUser, false)
        .showEquipment,
    ).toBe(true);
    expect(
      getServiceSectionFlags([schemaEquipmentRoom], standardUser, false)
        .showEquipment,
    ).toBe(false);
  });

  it("hides per-room sections and legacy catering from walk-ins but keeps equipment", () => {
    const catering = getServiceSectionFlags([schemaCateringRoom], walkIn, true);
    expect(catering.showSchemaSections).toBe(false);
    expect(catering.showGenericSetup).toBe(false);
    expect(hasAnyServiceSection(catering)).toBe(false);

    const legacy = getServiceSectionFlags([legacyCateringRoom], walkIn, true);
    expect(legacy.showLegacyCatering).toBe(false);
    expect(hasAnyServiceSection(legacy)).toBe(false);

    const equipment = getServiceSectionFlags(
      [legacyEquipmentRoom],
      walkIn,
      false,
    );
    expect(equipment.showEquipment).toBe(true);
    expect(hasAnyServiceSection(equipment)).toBe(true);
  });

  it("hides sections whose mode is hidden", () => {
    expect(
      hasAnyServiceSection(
        getServiceSectionFlags([hiddenSectionRoom], standardUser, false),
      ),
    ).toBe(false);
  });

  it("surfaces the first catering description for the legacy switch", () => {
    const described = {
      roomId: "109",
      services: ["catering"],
    };
    expect(
      getServiceSectionFlags([described], standardUser, false)
        .cateringDescriptionHtml,
    ).toBeUndefined();
  });
});

describe("getRequestOrigin", () => {
  it("derives the origin flags from the form context", () => {
    expect(getRequestOrigin(FormContextLevel.WALK_IN)).toMatchObject({
      isWalkIn: true,
      isVIP: false,
      isMod: false,
      isBooking: false,
      isStandardUser: false,
    });
    expect(getRequestOrigin(FormContextLevel.FULL_FORM)).toMatchObject({
      isWalkIn: false,
      isVIP: false,
      isMod: false,
      isBooking: true,
      isStandardUser: true,
    });
    expect(getRequestOrigin(FormContextLevel.MODIFICATION)).toMatchObject({
      isMod: true,
      isBooking: true,
    });
  });

  it("treats an edit of a VIP booking as VIP", () => {
    expect(
      getRequestOrigin(FormContextLevel.EDIT, BookingOrigin.VIP),
    ).toMatchObject({ isVIP: true, isBooking: false, isStandardUser: false });
    expect(getRequestOrigin(FormContextLevel.EDIT)).toMatchObject({
      isVIP: false,
      isBooking: true,
    });
  });
});
