import { describe, expect, it } from "vitest";

import { makeTenantSchema } from "@/lib/tenant/tenantSchema";
import { generateDefaultSchema } from "@/components/src/client/routes/components/schemaTypes";
import { coerceTenantSchema } from "@/lib/tenant/coerceTenantSchema";

// JSON round-trip drops `undefined` and non-index array props (the legacy
// `__defaults__` marker), normalizing both sides to what Firestore actually
// stores / the app actually consumes.
const norm = (v: unknown) => JSON.parse(JSON.stringify(v));

describe("tenantSchema Zod parity — defaults", () => {
  for (const tenant of ["mc", "itp"]) {
    it(`parse({}) reproduces generateDefaultSchema(${tenant})`, () => {
      expect(norm(makeTenantSchema(tenant).parse({}))).toEqual(
        norm(generateDefaultSchema(tenant)),
      );
    });
  }
});

describe("tenantSchema Zod parity — coercion", () => {
  it("normalizes legacy roomId → resourceId like coerce", () => {
    const raw = { resources: [{ roomId: 101, name: "One" }] };
    const zod = norm(makeTenantSchema("mc").parse(raw));
    const legacy = norm(coerceTenantSchema(raw, "mc"));
    expect(zod.resources[0].resourceId).toBe("101");
    expect(zod.resources[0]).not.toHaveProperty("roomId");
    expect(legacy.resources[0].resourceId).toBe("101");
  });

  it("keeps unknown top-level keys (DB-ahead passthrough), like coerce", () => {
    const raw = { futureField: "x" };
    expect((makeTenantSchema("mc").parse(raw) as any).futureField).toBe("x");
    expect((coerceTenantSchema(raw, "mc") as any).futureField).toBe("x");
  });

  it("fills omitted top-level objects the same way coerce does", () => {
    const raw = { policy: "p" };
    const zod = norm(makeTenantSchema("mc").parse(raw));
    const legacy = norm(coerceTenantSchema(raw, "mc"));
    expect(zod.emailNotifications).toEqual(legacy.emailNotifications);
    expect(zod.origins).toEqual(legacy.origins);
    expect(zod.form).toEqual(legacy.form);
    expect(zod.calendarConfig).toEqual(legacy.calendarConfig);
  });

  it("defaults tenantId to the tenant arg when omitted, keeps it otherwise — like coerce", () => {
    // Omitted → defaults to the tenant argument.
    expect((makeTenantSchema("mc").parse({}) as any).tenantId).toBe("mc");
    expect((coerceTenantSchema({}, "mc") as any).tenantId).toBe("mc");
    // Present → both keep the stored value (URL override happens in the PUT
    // route, not in coercion).
    const raw = { tenantId: "wrong" };
    expect((makeTenantSchema("mc").parse(raw) as any).tenantId).toBe("wrong");
    expect((coerceTenantSchema(raw, "mc") as any).tenantId).toBe("wrong");
  });
});

describe("tenantSchema Zod — validation matches coerce", () => {
  const bad: Record<string, unknown>[] = [
    { resources: [{ resourceId: "a,b" }] }, // comma
    { resources: [{ resourceId: "" }] }, // empty
    { resources: [{ resourceId: "a" }, { resourceId: "a" }] }, // duplicate
    { resources: [{ resourceId: "a", roomId: "b" }] }, // conflict
  ];
  for (const raw of bad) {
    it(`rejects ${JSON.stringify(raw.resources)}`, () => {
      expect(() => makeTenantSchema("mc").parse(raw)).toThrow();
      expect(() => coerceTenantSchema(raw, "mc")).toThrow();
    });
  }
});

describe("tenantSchema Zod — intended improvement over coerce", () => {
  it("fills resource-level defaults that coerce leaves undefined", () => {
    const raw = { resources: [{ resourceId: "a", name: "A" }] };
    const zodR = (makeTenantSchema("mc").parse(raw) as any).resources[0];
    const legacyR = (coerceTenantSchema(raw, "mc") as any).resources[0];

    // Zod fills these from the schema defaults...
    expect(zodR.isWalkIn).toBe(false);
    expect(zodR.maxHour.student).toBe(-1);
    expect(zodR.requestLimits.perDay.admin).toBe(-1);

    // ...while today's coerce leaves them undefined (the drift this fixes).
    expect(legacyR.isWalkIn).toBeUndefined();
    expect(legacyR.maxHour).toBeUndefined();
    expect(legacyR.requestLimits).toBeUndefined();
  });
});
