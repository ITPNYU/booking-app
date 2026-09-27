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
  const config = (
    memoViewRoles: any[],
    memoEditRoles: any[] = memoViewRoles,
    showMemo = true,
  ) => ({ showMemo, memoViewRoles, memoEditRoles });

  it("is false when showMemo is off", () => {
    const off = config(["SUPER_ADMIN"], ["SUPER_ADMIN"], false);
    expect(canAccessMemo(off, PagePermission.SUPER_ADMIN, "view")).toBe(false);
    expect(canAccessMemo(off, PagePermission.SUPER_ADMIN, "edit")).toBe(false);
  });

  it("uses the permission hierarchy", () => {
    expect(canAccessMemo(config(["PA"]), PagePermission.ADMIN, "edit")).toBe(
      true,
    );
    expect(canAccessMemo(config(["PA"]), PagePermission.LIAISON, "edit")).toBe(
      false,
    );
    expect(
      canAccessMemo(config(["ADMIN"]), PagePermission.SERVICES, "edit"),
    ).toBe(false);
    expect(
      canAccessMemo(config(["ADMIN"]), PagePermission.SUPER_ADMIN, "edit"),
    ).toBe(true);
    expect(
      canAccessMemo(config(["SERVICES"]), PagePermission.BOOKING, "view"),
    ).toBe(false);
  });

  it("separates view roles from edit roles", () => {
    const c = config(["PA", "SERVICES"], ["SERVICES"]);
    expect(canAccessMemo(c, PagePermission.PA, "view")).toBe(true);
    expect(canAccessMemo(c, PagePermission.PA, "edit")).toBe(false);
    expect(canAccessMemo(c, PagePermission.SERVICES, "edit")).toBe(true);
  });

  it("lets edit roles view even when they are not listed as view roles", () => {
    const c = config(["ADMIN"], ["LIAISON"]);
    expect(canAccessMemo(c, PagePermission.LIAISON, "view")).toBe(true);
    expect(canAccessMemo(c, PagePermission.LIAISON, "edit")).toBe(true);
    expect(canAccessMemo(c, PagePermission.PA, "view")).toBe(false);
  });
});

describe("isMemoContextAllowed", () => {
  it("maps each staff context to its role", () => {
    const d = (roles: any[]) => ({ memoViewRoles: roles, memoEditRoles: roles });
    expect(isMemoContextAllowed(d(["PA"]), PageContextLevel.PA, "edit")).toBe(
      true,
    );
    expect(
      isMemoContextAllowed(d(["PA"]), PageContextLevel.ADMIN, "edit"),
    ).toBe(false);
    expect(
      isMemoContextAllowed(d(["LIAISON"]), PageContextLevel.LIAISON, "edit"),
    ).toBe(true);
    expect(
      isMemoContextAllowed(d(["SERVICES"]), PageContextLevel.SERVICES, "edit"),
    ).toBe(true);
    expect(
      isMemoContextAllowed(d(["ADMIN"]), PageContextLevel.ADMIN, "edit"),
    ).toBe(true);
    expect(
      isMemoContextAllowed(d(["SUPER_ADMIN"]), PageContextLevel.ADMIN, "edit"),
    ).toBe(true);
  });

  it("grants view but not edit to a view-only context", () => {
    const c = { memoViewRoles: ["PA"] as any, memoEditRoles: ["ADMIN"] as any };
    expect(isMemoContextAllowed(c, PageContextLevel.PA, "view")).toBe(true);
    expect(isMemoContextAllowed(c, PageContextLevel.PA, "edit")).toBe(false);
    expect(isMemoContextAllowed(c, PageContextLevel.ADMIN, "view")).toBe(true);
    expect(isMemoContextAllowed(c, PageContextLevel.ADMIN, "edit")).toBe(true);
  });

  it("never allows the USER context or a missing context", () => {
    const roles = ["PA", "LIAISON", "SERVICES", "ADMIN", "SUPER_ADMIN"] as any;
    const all = { memoViewRoles: roles, memoEditRoles: roles };
    for (const access of ["view", "edit"] as const) {
      expect(isMemoContextAllowed(all, PageContextLevel.USER, access)).toBe(
        false,
      );
      expect(isMemoContextAllowed(all, undefined, access)).toBe(false);
    }
  });
});

describe("coerceTenantSchema detailsModal", () => {
  it("defaults detailsModal when the stored document has none", () => {
    const out = coerceTenantSchema({ tenantId: "mc" }, "mc");
    expect(out.detailsModal).toEqual(
      generateDefaultSchema("mc").detailsModal,
    );
    expect(out.detailsModal.showWebCheckout).toBe(true);
    expect(out.detailsModal.showMemo).toBe(false);
    expect(out.detailsModal.memoEditRoles).toEqual([...DEFAULT_MEMO_ROLES]);
  });

  it("merges a partial stored detailsModal over the defaults and normalizes roles", () => {
    const out = coerceTenantSchema(
      {
        detailsModal: {
          showMemo: true,
          memoViewRoles: ["PA", "bogus"],
          memoEditRoles: ["ADMIN", "ADMIN"],
        },
      },
      "mc",
    );
    expect(out.detailsModal).toEqual({
      showWebCheckout: true,
      showMemo: true,
      memoViewRoles: ["PA"],
      memoEditRoles: ["ADMIN"],
    });
  });

  it("keeps form free of memo settings", () => {
    const out = coerceTenantSchema({}, "mc");
    expect("showMemo" in out.form).toBe(false);
  });
});
