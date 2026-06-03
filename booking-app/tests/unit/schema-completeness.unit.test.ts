import { describe, expect, it } from "vitest";
import { defaultScheme } from "../../components/src/client/routes/components/SchemaProvider";

/**
 * This list must match every key in SchemaContextType (including optional fields).
 * When you add a new field to SchemaContextType, add it here too — this test
 * will fail and remind you to also add a default value in defaultScheme.
 *
 * Note: "tenantId" is omitted because defaultScheme is typed as
 * Omit<SchemaContextType, "tenantId"> — tenantId is set at runtime.
 */
const ALL_SCHEMA_KEYS = [
  "tenant",
  "policy",
  "mappings",
  "roles",
  "form",
  "attestations",
  "resources",
  "origins",
  "training",
  "supportPA",
  "supportLiaison",
  "resourceName",
  "declinedGracePeriod",
  "interimHighlightThresholdHours",
  "autoCancel",
  "calendarConfig",
  "ccEmails",
  "emailNotifications",
];

describe("Schema completeness", () => {
  const defaultKeys = Object.keys(defaultScheme);

  it("defaultScheme includes all SchemaContextType fields", () => {
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
