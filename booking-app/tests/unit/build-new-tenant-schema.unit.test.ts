import { buildNewTenantSchema } from "@/lib/tenant/buildNewTenantSchema";
import { describe, expect, it } from "vitest";

describe("buildNewTenantSchema", () => {
  it("applies identity and starts with no rooms", () => {
    const schema = buildNewTenantSchema({
      tenantId: " studio ",
      name: " Studio Lab ",
      nameForPolicy: "Studio policy",
      logo: "https://example.test/logo.png",
      resourceName: "",
    });

    expect(schema.tenantId).toBe("studio");
    expect(schema.tenant.name).toBe("Studio Lab");
    expect(schema.tenant.nameForPolicy).toBe("Studio policy");
    expect(schema.tenant.logo).toBe("https://example.test/logo.png");
    expect(schema.resourceName).toBe("Room");
    expect(schema.resources).toEqual([]);
    expect(JSON.stringify(schema)).not.toContain("__defaults__");
  });
});
