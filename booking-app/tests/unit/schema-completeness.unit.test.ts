import { describe, expect, it } from "vitest";
import { generateDefaultSchema } from "../../components/src/client/routes/components/SchemaProvider";

/**
 * This list must match every key in SchemaContextType (including optional fields).
 * When you add a new field to SchemaContextType, add it here too — this test
 * will fail and remind you to also add a default value in defaultScheme.
 */
const ALL_SCHEMA_KEYS = [
  "tenant",
  "name",
  "safetyTrainingGoogleFormId",
  "logo",
  "nameForPolicy",
  "policy",
  "programMapping",
  "roles",
  "roleMapping",
  "permissionLabels",
  "schoolMapping",
  "showNNumber",
  "showSponsor",
  "showSetup",
  "showEquipment",
  "showStaffing",
  "showCatering",
  "showHireSecurity",
  "showBookingTypes",
  "agreements",
  "resources",
  "supportVIP",
  "supportWalkIn",
  "supportPA",
  "supportLiaison",
  "resourceName",
  "declinedGracePeriod",
  "timeSensitiveRequestWarning",
  "calendarConfig",
  "ccEmails",
  "emailMessages",
];

describe("Schema completeness", () => {
  const defaultSchema = generateDefaultSchema("test");

  it("defaultScheme includes all SchemaContextType fields", () => {
    const defaultKeys = Object.keys(defaultSchema);

    const missingFromDefaults = ALL_SCHEMA_KEYS.filter(
      (key) => !defaultKeys.includes(key),
    );

    expect(
      missingFromDefaults,
      `These SchemaContextType fields are missing from defaultScheme. ` +
        `Add a default value in SchemaProvider.tsx defaultScheme: ${missingFromDefaults.join(", ")}`,
    ).toEqual([]);
  });

  it("ALL_SCHEMA_KEYS list is up to date with defaultScheme", () => {
    const defaultKeys = Object.keys(defaultSchema);

    const missingFromList = defaultKeys.filter(
      (key) => !ALL_SCHEMA_KEYS.includes(key),
    );

    expect(
      missingFromList,
      `These defaultScheme keys are not in ALL_SCHEMA_KEYS. ` +
        `Add them to the list in schema-completeness.unit.test.ts: ${missingFromList.join(", ")}`,
    ).toEqual([]);
  });
});
