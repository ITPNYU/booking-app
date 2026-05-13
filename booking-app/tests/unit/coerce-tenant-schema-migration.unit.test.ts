import { describe, expect, it } from "vitest";
import {
  isNestedTenantSchemaDocument,
  tenantSchemaFirestoreDocNeedsShapeMigration,
} from "@/lib/tenant/coerceTenantSchema";

describe("tenantSchemaFirestoreDocNeedsShapeMigration", () => {
  it("returns true for flat legacy top-level fields", () => {
    expect(
      tenantSchemaFirestoreDocNeedsShapeMigration({
        name: "MC",
        emailMessages: { requestConfirmation: "t1" },
        resources: [],
      }),
    ).toBe(true);
  });

  it("returns true when tenant is a legacy string slug", () => {
    expect(
      tenantSchemaFirestoreDocNeedsShapeMigration({
        tenant: "mc",
        resources: [],
      }),
    ).toBe(true);
  });

  it("returns true when nested shape still has stale legacy keys", () => {
    expect(
      tenantSchemaFirestoreDocNeedsShapeMigration({
        tenantId: "mc",
        tenant: { name: "x", logo: "", nameForPolicy: "", contextLabels: {} },
        mappings: { program: {}, role: {}, school: {} },
        form: { showBookingType: true, showNNumber: true, showSponsor: true, services: {} },
        emailMessages: { requestConfirmation: "old" },
        emailNotifications: { requestedUser: "new" },
      } as Record<string, unknown>),
    ).toBe(true);
  });

  it("returns false for minimal nested canonical doc", () => {
    const doc = {
      tenantId: "mc",
      tenant: {
        name: "Media Commons",
        logo: "",
        nameForPolicy: "",
        contextLabels: {
          user: "User",
          worker: "PA",
          reviewer: "Liaison",
          services: "Services",
          admin: "Admin",
        },
      },
      mappings: { program: {}, role: {}, school: {} },
      form: {
        showBookingType: true,
        showNNumber: true,
        showSponsor: true,
        services: {
          showCatering: true,
          showEquipment: true,
          showSecurity: true,
          showSetup: true,
          showStaffing: true,
        },
      },
      origins: { VIP: false, walkIn: false },
      emailNotifications: { requestedUser: "" },
    };
    expect(tenantSchemaFirestoreDocNeedsShapeMigration(doc)).toBe(false);
    expect(isNestedTenantSchemaDocument(doc)).toBe(true);
  });
});
