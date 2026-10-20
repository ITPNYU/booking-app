import { ALLOWED_TENANTS, isValidTenant } from "@/components/src/constants/tenants";
import { isCreatableTenantSlug } from "@/lib/tenant/tenantSlug";
import { describe, expect, it } from "vitest";

describe("tenant schema slugs", () => {
  it("keeps booking routes limited to the existing tenants", () => {
    expect(ALLOWED_TENANTS).toEqual(["mc", "mediaCommons", "itp"]);
    expect(isValidTenant("studio")).toBe(false);
    expect(isValidTenant("mc")).toBe(true);
    expect(isValidTenant("itp")).toBe(true);
  });

  it("accepts a new schema slug and rejects reserved or malformed ones", () => {
    expect(isCreatableTenantSlug("studio")).toBe(true);
    expect(isCreatableTenantSlug("a")).toBe(true);
    expect(isCreatableTenantSlug(`n${"a".repeat(30)}`)).toBe(true);
    expect(isCreatableTenantSlug(`n${"a".repeat(31)}`)).toBe(false);
    expect(isCreatableTenantSlug("_template")).toBe(false);
    expect(isCreatableTenantSlug("api")).toBe(false);
    expect(isCreatableTenantSlug("signin")).toBe(false);
    expect(isCreatableTenantSlug("mediaCommons")).toBe(false);
    expect(isCreatableTenantSlug("Studio")).toBe(false);
    expect(isCreatableTenantSlug("")).toBe(false);
  });
});
