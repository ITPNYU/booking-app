import { describe, expect, it } from "vitest";
import { PageContextLevel, PagePermission } from "@/components/src/types";
import {
  DEFAULT_MEMO_ROLES,
  generateDefaultSchema,
} from "@/components/src/client/routes/components/schemaTypes";
import {
  canAccessMemo,
  isMemoContextAllowed,
  normalizeMemoRoles,
} from "@/components/src/utils/bookingMemoAccess";
import { coerceTenantSchema } from "@/lib/tenant/coerceTenantSchema";

describe("normalizeMemoRoles", () => {
  it("returns the defaults for a non-array", () => {
    expect(normalizeMemoRoles(undefined)).toEqual([...DEFAULT_MEMO_ROLES]);
    expect(normalizeMemoRoles("ADMIN")).toEqual([...DEFAULT_MEMO_ROLES]);
  });

  it("drops unknown roles and duplicates", () => {
    expect(
      normalizeMemoRoles(["PA", "BOOKING", "nope", "PA", "ADMIN"]),
    ).toEqual(["PA", "ADMIN"]);
  });

  it("falls back to the defaults when nothing valid remains", () => {
    expect(normalizeMemoRoles(["BOOKING", 3])).toEqual([...DEFAULT_MEMO_ROLES]);
  });
});

describe("canAccessMemo", () => {
  const detail = (memoRoles: any[], showMemo = true) => ({
    showMemo,
    memoRoles,
  });

  it("is false when showMemo is off", () => {
    expect(
      canAccessMemo(detail(["SUPER_ADMIN"], false), PagePermission.SUPER_ADMIN),
    ).toBe(false);
  });

  it("uses the permission hierarchy", () => {
    expect(canAccessMemo(detail(["PA"]), PagePermission.ADMIN)).toBe(true);
    expect(canAccessMemo(detail(["PA"]), PagePermission.LIAISON)).toBe(false);
    expect(canAccessMemo(detail(["ADMIN"]), PagePermission.SERVICES)).toBe(
      false,
    );
    expect(canAccessMemo(detail(["ADMIN"]), PagePermission.SUPER_ADMIN)).toBe(
      true,
    );
    expect(canAccessMemo(detail(["SERVICES"]), PagePermission.BOOKING)).toBe(
      false,
    );
  });
});

describe("isMemoContextAllowed", () => {
  it("maps each staff context to its role", () => {
    const d = (memoRoles: any[]) => ({ memoRoles });
    expect(isMemoContextAllowed(d(["PA"]), PageContextLevel.PA)).toBe(true);
    expect(isMemoContextAllowed(d(["PA"]), PageContextLevel.ADMIN)).toBe(false);
    expect(isMemoContextAllowed(d(["LIAISON"]), PageContextLevel.LIAISON)).toBe(
      true,
    );
    expect(
      isMemoContextAllowed(d(["SERVICES"]), PageContextLevel.SERVICES),
    ).toBe(true);
    expect(isMemoContextAllowed(d(["ADMIN"]), PageContextLevel.ADMIN)).toBe(
      true,
    );
    expect(
      isMemoContextAllowed(d(["SUPER_ADMIN"]), PageContextLevel.ADMIN),
    ).toBe(true);
  });

  it("never allows the USER context or a missing context", () => {
    const all = {
      memoRoles: ["PA", "LIAISON", "SERVICES", "ADMIN", "SUPER_ADMIN"] as any,
    };
    expect(isMemoContextAllowed(all, PageContextLevel.USER)).toBe(false);
    expect(isMemoContextAllowed(all, undefined)).toBe(false);
  });
});

describe("coerceTenantSchema detail", () => {
  it("defaults detail when the stored document has none", () => {
    const out = coerceTenantSchema({ tenantId: "mc" }, "mc");
    expect(out.detail).toEqual(generateDefaultSchema("mc").detail);
    expect(out.detail.showWebCheckout).toBe(true);
    expect(out.detail.showMemo).toBe(false);
  });

  it("merges a partial stored detail over the defaults and normalizes roles", () => {
    const out = coerceTenantSchema(
      { detail: { showMemo: true, memoRoles: ["PA", "bogus"] } },
      "mc",
    );
    expect(out.detail).toEqual({
      showWebCheckout: true,
      showMemo: true,
      memoRoles: ["PA"],
    });
  });

  it("keeps form free of memo settings", () => {
    const out = coerceTenantSchema({}, "mc");
    expect("showMemo" in out.form).toBe(false);
  });
});
