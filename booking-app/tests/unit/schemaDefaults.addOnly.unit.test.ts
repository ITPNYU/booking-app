import { describe, expect, it } from "vitest";
import { mergeSchemaDefaults } from "../../scripts/schemaDefaults";

describe("scripts/schemaDefaults mergeSchemaDefaults (add-only)", () => {
  it("preserves existing mapping children and does not overwrite existing minHour/maxHour", () => {
    const existingSchema: any = {
      tenant: "mc",
      // Extra top-level keys must survive (script must be non-destructive)
      someExtraTopLevelKey: { keepMe: true },
      // These mappings are where prod data got wiped (extra keys/values not present in template)
      programMapping: {
        "Template Program": ["TEMPLATE_VALUE"],
        "Prod Only Program": ["PROD_CHILD_A", "PROD_CHILD_B"],
      },
      roleMapping: {
        Student: ["STUDENT", "PROD_EXTRA_ROLE_CHILD"],
      },
      schoolMapping: {
        "Tisch School of the Arts": ["ITP / IMA / Low Res"],
        "Prod Only School": ["PROD_SCHOOL_CHILD"],
      },
      // Resources array uses __defaults__ item merge in the sync logic; we must not overwrite.
      resources: [
        {
          name: "Prod Room",
          roomId: 999,
          capacity: 1,
          isEquipment: false,
          calendarId: "prod-calendar",
          isWalkIn: false,
          isWalkInCanBookTwo: false,
          services: [],
          minHour: { student: 2 },
          maxHour: { student: 9 },
          extraResourceKey: "keep-me",
        },
      ],
    };

    const merged = mergeSchemaDefaults(existingSchema, "mc") as any;

    // Never delete existing mapping keys or values
    expect(merged.programMapping["Prod Only Program"]).toEqual([
      "PROD_CHILD_A",
      "PROD_CHILD_B",
    ]);
    expect(merged.roleMapping.Student).toContain("PROD_EXTRA_ROLE_CHILD");
    expect(merged.schoolMapping["Prod Only School"]).toEqual(["PROD_SCHOOL_CHILD"]);

    // Never overwrite existing configured values with template defaults
    // (it may still add missing role keys alongside the existing ones)
    expect(merged.resources[0].minHour.student).toBe(2);
    expect(merged.resources[0].maxHour.student).toBe(9);

    // Never delete extra keys (top-level and within resource items)
    expect(merged.someExtraTopLevelKey).toEqual({ keepMe: true });
    expect(merged.resources[0].extraResourceKey).toBe("keep-me");

    // Still adds missing template defaults (spot-check a known required field)
    expect(merged.permissionLabels).toBeTruthy();
    expect(typeof merged.permissionLabels.admin).toBe("string");
  });
});

