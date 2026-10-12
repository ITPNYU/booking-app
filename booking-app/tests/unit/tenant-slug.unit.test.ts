import { describe, expect, it } from "vitest";
import { getMachineForTenant } from "@/lib/stateMachines/xstatePersistence";
import {
  isCreatableTenantSlug,
  isReservedTenantSlug,
  isTenantSlugShape,
} from "@/lib/tenant/tenantSlug";

describe("tenant slug rules", () => {
  it("accepts a lowercase slug", () => {
    expect(isCreatableTenantSlug("studio")).toBe(true);
    expect(isCreatableTenantSlug("lab-2")).toBe(true);
  });

  it("rejects reserved, uppercase, and underscore slugs", () => {
    expect(isReservedTenantSlug("_template")).toBe(true);
    expect(isCreatableTenantSlug("_template")).toBe(false);
    expect(isCreatableTenantSlug("api")).toBe(false);
    expect(isCreatableTenantSlug("signin")).toBe(false);
    expect(isCreatableTenantSlug("mediaCommons")).toBe(false);
    expect(isTenantSlugShape("Bad")).toBe(false);
    expect(isCreatableTenantSlug("invalid_tenant")).toBe(false);
  });
});

describe("getMachineForTenant", () => {
  it("keeps mc and itp on their own machines", () => {
    expect(getMachineForTenant("mc", "itp").id).toBe("MC Booking Request");
    expect(getMachineForTenant("itp", "mc").id).toBe("ITP Booking Request");
  });

  it("uses bookingProfile for any other slug", () => {
    expect(getMachineForTenant("studio", "itp").id).toBe("ITP Booking Request");
    expect(getMachineForTenant("studio", "mc").id).toBe("MC Booking Request");
    expect(getMachineForTenant("studio").id).toBe("ITP Booking Request");
  });
});
