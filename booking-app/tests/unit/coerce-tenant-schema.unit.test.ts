import { describe, expect, it } from "vitest";
import { defaultFormAlerts } from "../../components/src/client/routes/components/schemaTypes";
import { coerceTenantSchema } from "../../lib/tenant/coerceTenantSchema";

describe("coerceTenantSchema — timeSensitiveRequestWarning", () => {
  const warning = {
    hours: 72,
    isActive: true,
    message: "Heads up",
    policyLink: "https://policy.example",
  };

  const canonicalBase = {
    tenantId: "mc",
    tenant: { name: "Media Commons", logo: "", nameForPolicy: "" },
    mappings: { program: {}, role: {}, school: {} },
    form: { services: {} },
  };

  it("keeps a nested calendarConfig warning from a canonical document", () => {
    const doc: any = {
      ...canonicalBase,
      calendarConfig: { timeSensitiveRequestWarning: warning },
    };
    const c = coerceTenantSchema(doc, "mc");
    expect(c.calendarConfig?.timeSensitiveRequestWarning).toMatchObject(
      warning,
    );
  });

  it("merges a partial nested warning over the defaults", () => {
    const doc: any = {
      ...canonicalBase,
      calendarConfig: { timeSensitiveRequestWarning: { hours: 99 } },
    };
    const c = coerceTenantSchema(doc, "mc");
    expect(c.calendarConfig?.timeSensitiveRequestWarning?.hours).toBe(99);
  });
});

describe("coerceTenantSchema — form alerts", () => {
  it("fills the default alerts when the document omits them", () => {
    const coerced = coerceTenantSchema({ tenantId: "mc" }, "mc");
    expect(coerced.form.alerts).toEqual(defaultFormAlerts);
  });

  it("replaces the default alerts with the stored list", () => {
    const alerts = [
      {
        id: "vipEligible",
        slot: "status" as const,
        showInOrigin: { user: false, VIP: true, walkIn: false },
        when: { autoApproval: "eligible" as const },
        severity: "info" as const,
        message: "This VIP request can be submitted.",
      },
    ];

    const coerced = coerceTenantSchema(
      { tenantId: "mc", form: { alerts } },
      "mc",
    );

    expect(coerced.form.alerts).toEqual(alerts);
  });
});

describe("coerceTenantSchema — resources", () => {
  it.each([
    ["number", 202, "202"],
    ["string", "studio-a", "studio-a"],
  ])("coerces a legacy %s roomId to resourceId", (_, roomId, resourceId) => {
    const resource = {
      roomId,
      name: "Studio",
      capacity: 12,
      customField: { keep: true },
    };

    const coerced = coerceTenantSchema({ resources: [resource] }, "itp");

    expect(coerced.resources[0]).toEqual({
      resourceId,
      name: "Studio",
      capacity: 12,
      customField: { keep: true },
    });
    expect(coerced.resources[0]).not.toHaveProperty("roomId");
  });

  it("does not seed MC service configs from code (Firestore is the source of truth)", () => {
    const coerced = coerceTenantSchema(
      {
        resources: [
          { roomId: "202", name: "Studio", capacity: 12 },
          { roomId: "103", name: "Garage", capacity: 50, services: ["setup"] },
        ],
      },
      "mc",
    );

    expect(coerced.resources[0].resourceId).toBe("202");
    expect(coerced.resources[0].services).toBeUndefined();
    // Legacy string[] services are normalized, not replaced by room defaults.
    expect(coerced.resources[1].services).toEqual({
      setup: { label: "Room Setup" },
    });
  });

  it("keeps explicit services objects as written", () => {
    const coerced = coerceTenantSchema(
      {
        resources: [
          { resourceId: "202", name: "Studio", capacity: 12, services: {} },
        ],
      },
      "mc",
    );
    expect(coerced.resources[0].services).toEqual({});
  });

  it("keeps a canonical resourceId and removes a matching legacy roomId", () => {
    const coerced = coerceTenantSchema(
      {
        resources: [
          {
            resourceId: "canonical-id",
            roomId: "canonical-id",
            name: "Canonical resource",
          },
        ],
      },
      "itp",
    );

    expect(coerced.resources[0].resourceId).toBe("canonical-id");
    expect(coerced.resources[0]).not.toHaveProperty("roomId");
  });

  it("rejects conflicting legacy and canonical IDs", () => {
    expect(() =>
      coerceTenantSchema(
        { resources: [{ resourceId: "studio-a", roomId: 202 }] },
        "itp",
      ),
    ).toThrow("conflicting resourceId and roomId");
  });

  it("rejects duplicate canonical IDs", () => {
    expect(() =>
      coerceTenantSchema(
        {
          resources: [{ resourceId: "studio-a" }, { roomId: "studio-a" }],
        },
        "itp",
      ),
    ).toThrow('duplicate resourceId "studio-a"');
  });
});
