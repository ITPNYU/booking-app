import { describe, expect, it } from "vitest";
import { mergeSchemaDefaults } from "../../scripts/schemaDefaults";

describe("scripts/schemaDefaults mergeSchemaDefaults (add-only)", () => {
  it("preserves existing mapping children and does not overwrite existing minHour/maxHour", () => {
    const existingSchema: any = {
      tenantId: "mc",
      tenant: { name: "Media Commons", logo: "", nameForPolicy: "" },
      // Extra top-level keys must survive (script must be non-destructive)
      someExtraTopLevelKey: { keepMe: true },
      // These mappings are where prod data got wiped (extra keys/values not present in template)
      mappings: {
        program: {
          "Template Program": ["TEMPLATE_VALUE"],
          "Prod Only Program": ["PROD_CHILD_A", "PROD_CHILD_B"],
        },
        role: {
          Student: ["STUDENT", "PROD_EXTRA_ROLE_CHILD"],
        },
        school: {
          "Tisch School of the Arts": ["ITP / IMA / Low Res"],
          "Prod Only School": ["PROD_SCHOOL_CHILD"],
        },
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
    expect(merged.mappings.program["Prod Only Program"]).toEqual([
      "PROD_CHILD_A",
      "PROD_CHILD_B",
    ]);
    expect(merged.mappings.role.Student).toContain("PROD_EXTRA_ROLE_CHILD");
    expect(merged.mappings.school["Prod Only School"]).toEqual(["PROD_SCHOOL_CHILD"]);

    // Never overwrite existing configured values with template defaults
    // (it may still add missing role keys alongside the existing ones)
    expect(merged.resources[0].minHour.student).toBe(2);
    expect(merged.resources[0].maxHour.student).toBe(9);

    // Never delete extra keys (top-level and within resource items)
    expect(merged.someExtraTopLevelKey).toEqual({ keepMe: true });
    expect(merged.resources[0].extraResourceKey).toBe("keep-me");

    // Still adds missing template defaults (spot-check a known required field)
    expect(merged.tenant.contextLabels).toBeTruthy();
    expect(typeof merged.tenant.contextLabels.admin).toBe("string");
  });

  // Regression guard: empty nested defaults that the merge injects
  // (emailNotifications, attestations, resource.training) must NOT shadow the
  // real configured values already present on the stored document.
  it("does not blank configured email/attestation/training values via injected defaults", () => {
    const existingSchema: any = {
      tenantId: "mc",
      tenant: { name: "Media Commons", logo: "", nameForPolicy: "" },
      emailNotifications: {
        requestedUser: "Your request was received.",
        declined: "Sorry, declined.",
      },
      attestations: [{ id: "liability", html: "<p>I agree</p>" }],
      resources: [
        {
          name: "Trained Room",
          roomId: 1234,
          capacity: 10,
          isEquipment: false,
          calendarId: "cal",
          isWalkIn: false,
          isWalkInCanBookTwo: false,
          services: [],
          training: {
            required: true,
            formId: "https://forms.example/abc",
            infoUrl: "https://info.example/abc",
          },
        },
      ],
    };

    const merged = mergeSchemaDefaults(existingSchema, "mc") as any;

    // Configured email messages survive
    expect(merged.emailNotifications.requestedUser).toBe(
      "Your request was received.",
    );
    expect(merged.emailNotifications.declined).toBe("Sorry, declined.");

    // Configured attestations survive (empty default must not win)
    expect(merged.attestations).toHaveLength(1);
    expect(merged.attestations[0].id).toBe("liability");

    // Configured resource training survives
    expect(merged.resources[0].training.required).toBe(true);
    expect(merged.resources[0].training.formId).toBe(
      "https://forms.example/abc",
    );
    expect(merged.resources[0].training.infoUrl).toBe(
      "https://info.example/abc",
    );
  });
});
