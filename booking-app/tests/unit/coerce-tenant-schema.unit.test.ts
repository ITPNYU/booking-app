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
