import { describe, expect, it } from "vitest";
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
    expect(c.calendarConfig?.timeSensitiveRequestWarning).toMatchObject(warning);
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

  it("applies MC room service configs when coercing the mc tenant", () => {
    const coerced = coerceTenantSchema(
      {
        resources: [{ roomId: "202", name: "Studio", capacity: 12 }],
      },
      "mc",
    );

    expect(coerced.resources[0].resourceId).toBe("202");
    expect(coerced.resources[0].services?.setup?.mode).toBe("static");
    expect(coerced.resources[0].services?.catering?.forceCleaning).toBe(true);
    expect(coerced.resources[0].services?.catering?.chartField?.required).toBe(
      true,
    );
    expect(coerced.resources[0].services?.annex?.mode).toBe("radio");
  });

  it("preserves Firestore object services config for mc tenant", () => {
    const customServices = {
      catering: { label: "Custom Catering" },
    };
    const coerced = coerceTenantSchema(
      {
        resources: [
          {
            resourceId: "202",
            name: "Studio",
            capacity: 12,
            services: customServices,
          },
        ],
      },
      "mc",
    );

    expect(coerced.resources[0].services?.catering?.label).toBe(
      "Custom Catering",
    );
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
          resources: [
            { resourceId: "studio-a" },
            { roomId: "studio-a" },
          ],
        },
        "itp",
      ),
    ).toThrow('duplicate resourceId "studio-a"');
  });
});
