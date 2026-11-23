import { describe, expect, it } from "vitest";
import {
  defaultResource,
  defaultScheme,
  generateDefaultSchema,
  resourceSchema,
  tenantSchema,
} from "../../components/src/client/routes/components/schemaTypes";

describe("Schema completeness", () => {
  it("an empty object fills every tenant field from the schema", () => {
    const parsed = tenantSchema.omit({ tenantId: true }).parse({});
    expect(parsed).toEqual(defaultScheme);
  });

  it("resourceSchema.parse({}) is the new room", () => {
    const resource = resourceSchema.parse({});
    expect(resource).toEqual(defaultResource);
    expect(resource.resourceId).toBe("");
    expect(resource.capacity).toBe(0);
    expect(resource.requestLimits.perDay.admin).toBe(-1);
    expect(resource).not.toHaveProperty("roomId");
    expect(resource.staffingSections).not.toHaveProperty("__defaults__");
  });

  it("generateDefaultSchema passes and an empty resource id fails", () => {
    const schema = generateDefaultSchema("mc");
    const ok = tenantSchema.safeParse(schema);
    expect("error" in ok).toBe(false);
    expect(schema.form.productionSchedule.enabled).toBe(true);

    const itp = generateDefaultSchema("itp");
    expect(itp.tenant.contextLabels.worker).toBe("ER");
    expect(itp.form.productionSchedule.enabled).toBe(false);

    const bad = tenantSchema.safeParse({
      ...schema,
      resources: [{ ...defaultResource, resourceId: "" }],
    });
    expect("error" in bad).toBe(true);
    if ("error" in bad) {
      expect(
        bad.error.issues.some((issue) => issue.path.includes("resourceId")),
      ).toBe(true);
    }
  });
});
