import { describe, expect, it } from "vitest";
import { coerceTenantSchema } from "../../lib/tenant/coerceTenantSchema";

describe("coerceTenantSchema — timeSensitiveRequestWarning", () => {
  const warning = {
    hours: 72,
    isActive: true,
    message: "Heads up",
    policyLink: "https://policy.example",
  };

  it("picks up a top-level warning from a fully-legacy document", () => {
    const legacy: any = {
      tenant: "mc",
      name: "Media Commons",
      timeSensitiveRequestWarning: warning,
    };
    const c = coerceTenantSchema(legacy, "mc");
    expect(c.calendarConfig?.timeSensitiveRequestWarning).toMatchObject(warning);
  });

  it("picks up a top-level warning from a partially-migrated (new-shape) document", () => {
    // Nested tenant/mappings/form => coerce takes the new-shape branch, but the
    // warning is still stored at the legacy top level. It must not be dropped.
    const partial: any = {
      tenantId: "mc",
      tenant: { name: "Media Commons", logo: "", nameForPolicy: "" },
      mappings: { program: {}, role: {}, school: {} },
      form: { services: {} },
      timeSensitiveRequestWarning: warning,
    };
    const c = coerceTenantSchema(partial, "mc");
    expect(c.calendarConfig?.timeSensitiveRequestWarning).toMatchObject(warning);
  });

  it("prefers the nested warning over a stale top-level one", () => {
    const both: any = {
      tenantId: "mc",
      tenant: { name: "Media Commons", logo: "", nameForPolicy: "" },
      mappings: { program: {}, role: {}, school: {} },
      form: { services: {} },
      timeSensitiveRequestWarning: { ...warning, hours: 12 },
      calendarConfig: { timeSensitiveRequestWarning: { hours: 99 } },
    };
    const c = coerceTenantSchema(both, "mc");
    expect(c.calendarConfig?.timeSensitiveRequestWarning?.hours).toBe(99);
  });
});
