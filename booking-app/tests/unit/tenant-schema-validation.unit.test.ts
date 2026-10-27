import { generateDefaultSchema } from "@/components/src/client/routes/components/schemaTypes";
import { plainResourceDefault } from "@/lib/tenant/resourceDefault";
import { generateTenantSchemaDocument } from "../../scripts/generateTenantSchemaJson";
import {
  validateSchemaSlice,
  validateTemplateDocument,
  validateTenantDocument,
} from "@/lib/tenant/validateTenantSchema";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function roundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("tenant schema JSON Schema", () => {
  it("matches SchemaContextType", () => {
    const committed = JSON.parse(
      fs.readFileSync(path.join(root, "lib/tenant/tenantSchema.schema.json"), "utf8"),
    );
    expect(generateTenantSchemaDocument(root)).toEqual(committed);
  }, 30000);

  it("accepts the code default schema and the resource default", () => {
    expect(validateTenantDocument(roundTrip(generateDefaultSchema("mc")))).toEqual([]);
    expect(validateTenantDocument(roundTrip(generateDefaultSchema("itp")))).toEqual([]);
    expect(
      validateTemplateDocument({ resourceDefault: plainResourceDefault() }),
    ).toEqual([]);
  });

  it("reports a wrong type and a wrong enum on the edited slice", () => {
    const schema = roundTrip(generateDefaultSchema("mc"));
    (schema.form as { showBookingType: unknown }).showBookingType = "yes";
    const typeErrors = validateTenantDocument(schema);
    expect(typeErrors.some((issue) => issue.path === "form.showBookingType")).toBe(
      true,
    );

    const severityErrors = validateSchemaSlice(
      { kind: "section", key: "form" },
      {
        ...schema.form,
        alerts: [{ ...schema.form.alerts![0], severity: "nope" }],
      },
    );
    expect(severityErrors.some((issue) => issue.path.includes("severity"))).toBe(
      true,
    );
  });

  it("reports an empty or duplicate resource id", () => {
    const resource = {
      ...plainResourceDefault(),
      name: "Studio",
      resourceId: "",
    };
    expect(
      validateSchemaSlice({ kind: "resource", index: 0 }, resource).some(
        (issue) => issue.path === "resourceId" && issue.message.includes("non-empty"),
      ),
    ).toBe(true);

    const schema = roundTrip(generateDefaultSchema("mc"));
    schema.resources = [
      { ...plainResourceDefault(), name: "A", resourceId: "studio" },
      { ...plainResourceDefault(), name: "B", resourceId: "studio" },
    ];
    const issues = validateTenantDocument(schema);
    expect(
      issues.some((issue) => issue.message === 'duplicate resourceId "studio"'),
    ).toBe(true);
  });
});
