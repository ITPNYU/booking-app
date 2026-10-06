import { describe, expect, it } from "vitest";
import { PageContextLevel, PagePermission } from "@/components/src/types";
import {
  DEFAULT_MEMO_ROLES,
  DEFAULT_WEBCHECKOUT_ROLES,
  generateDefaultSchema,
} from "@/components/src/client/routes/components/schemaTypes";
import {
  canAccessMemo,
  canAccessWebCheckoutCart,
  isMemoContextAllowed,
  isWebCheckoutContextAllowed,
  normalizeMemoRoles,
  normalizeWebCheckoutRoles,
} from "@/components/src/utils/bookingMemoAccess";
import { coerceTenantSchema } from "@/lib/tenant/coerceTenantSchema";

describe("normalizeMemoRoles", () => {
  it("returns the defaults only when the list is unset", () => {
    expect(normalizeMemoRoles(undefined)).toEqual([...DEFAULT_MEMO_ROLES]);
    expect(normalizeMemoRoles(null)).toEqual([...DEFAULT_MEMO_ROLES]);
  });

  it("drops unknown roles and duplicates", () => {
    expect(
      normalizeMemoRoles(["PA", "BOOKING", "nope", "PA", "ADMIN"]),
    ).toEqual(["PA", "ADMIN"]);
  });

  it("respects an explicitly empty list", () => {
    expect(normalizeMemoRoles([])).toEqual([]);
  });

  it("fails closed when nothing valid remains", () => {
    expect(normalizeMemoRoles(["BOOKING", 3, "Admin"])).toEqual([]);
  });

  it("fails closed on a malformed non-array value", () => {
    expect(normalizeMemoRoles("ADMIN")).toEqual([]);
    expect(normalizeMemoRoles({ ADMIN: true })).toEqual([]);
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

describe("memo access with the stored mc detailsModal", () => {
  const out = coerceTenantSchema(
    {
      form: { showMemo: true },
      detailsModal: {
        showWebCheckout: true,
        showMemo: true,
        memoViewRoles: ["SERVICES", "ADMIN", "SUPER_ADMIN"],
        memoEditRoles: ["ADMIN", "SUPER_ADMIN"],
      },
    },
    "mc",
  );
  const view = (perm: PagePermission, ctx: PageContextLevel) =>
    isMemoContextAllowed(out.detailsModal, ctx, "view") &&
    canAccessMemo(out.detailsModal, perm, "view");
  const edit = (perm: PagePermission, ctx: PageContextLevel) =>
    isMemoContextAllowed(out.detailsModal, ctx, "edit") &&
    canAccessMemo(out.detailsModal, perm, "edit");

  it("shows the memo read-only to Services on the Services page", () => {
    expect(view(PagePermission.SERVICES, PageContextLevel.SERVICES)).toBe(true);
    expect(edit(PagePermission.SERVICES, PageContextLevel.SERVICES)).toBe(false);
  });

  it("lets Admin and Super Admin view and edit on the Admin page", () => {
    for (const perm of [PagePermission.ADMIN, PagePermission.SUPER_ADMIN]) {
      expect(view(perm, PageContextLevel.ADMIN)).toBe(true);
      expect(edit(perm, PageContextLevel.ADMIN)).toBe(true);
    }
  });

  it("hides it from PA and Liaison pages", () => {
    expect(view(PagePermission.ADMIN, PageContextLevel.PA)).toBe(false);
    expect(view(PagePermission.ADMIN, PageContextLevel.LIAISON)).toBe(false);
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
      webCheckoutViewRoles: [...DEFAULT_WEBCHECKOUT_ROLES],
      webCheckoutEditRoles: [...DEFAULT_WEBCHECKOUT_ROLES],
      showMemo: true,
      memoViewRoles: ["PA"],
      memoEditRoles: ["ADMIN"],
    });
  });

  it("lets a tenant lock memo editing down to nobody", () => {
    const out = coerceTenantSchema(
      { detailsModal: { showMemo: true, memoEditRoles: [] } },
      "mc",
    );
    expect(out.detailsModal.memoEditRoles).toEqual([]);
    expect(out.detailsModal.memoViewRoles).toEqual([...DEFAULT_MEMO_ROLES]);
    expect(
      canAccessMemo(out.detailsModal, PagePermission.SUPER_ADMIN, "edit"),
    ).toBe(false);
    expect(
      canAccessMemo(out.detailsModal, PagePermission.SUPER_ADMIN, "view"),
    ).toBe(true);
  });

  it("grants nobody when a stored list has only typo'd roles", () => {
    const out = coerceTenantSchema(
      {
        detailsModal: {
          showMemo: true,
          memoViewRoles: ["Admin"],
          memoEditRoles: ["SERVICE"],
        },
      },
      "mc",
    );
    expect(out.detailsModal.memoViewRoles).toEqual([]);
    expect(out.detailsModal.memoEditRoles).toEqual([]);
    expect(
      canAccessMemo(out.detailsModal, PagePermission.SUPER_ADMIN, "view"),
    ).toBe(false);
  });

  it("keeps form free of memo settings", () => {
    const out = coerceTenantSchema({}, "mc");
    expect("showMemo" in out.form).toBe(false);
  });

  it("drops the legacy form.showMemo flag from stored documents", () => {
    const out = coerceTenantSchema(
      { form: { showMemo: true, showSponsor: false } },
      "mc",
    );
    expect("showMemo" in out.form).toBe(false);
    expect(out.form.showSponsor).toBe(false);
    expect(out.detailsModal.showMemo).toBe(false);
  });
});

describe("normalizeWebCheckoutRoles", () => {
  it("returns the WebCheckout defaults only when the list is unset", () => {
    expect(normalizeWebCheckoutRoles(undefined)).toEqual([
      ...DEFAULT_WEBCHECKOUT_ROLES,
    ]);
    expect(normalizeWebCheckoutRoles(null)).toEqual([
      ...DEFAULT_WEBCHECKOUT_ROLES,
    ]);
    expect([...DEFAULT_WEBCHECKOUT_ROLES]).toEqual(["PA", "ADMIN", "SUPER_ADMIN"]);
  });

  it("drops unknown roles and duplicates", () => {
    expect(
      normalizeWebCheckoutRoles(["SERVICES", "BOOKING", "SERVICES", "PA"]),
    ).toEqual(["SERVICES", "PA"]);
  });

  it("fails closed on an empty, all-unknown, or malformed list", () => {
    expect(normalizeWebCheckoutRoles([])).toEqual([]);
    expect(normalizeWebCheckoutRoles(["pa", 1])).toEqual([]);
    expect(normalizeWebCheckoutRoles("PA")).toEqual([]);
  });
});

describe("WebCheckout cart access", () => {
  const config = (
    webCheckoutViewRoles: any[],
    webCheckoutEditRoles: any[] = webCheckoutViewRoles,
    showWebCheckout = true,
  ) => ({ showWebCheckout, webCheckoutViewRoles, webCheckoutEditRoles });

  it("is false for everyone when showWebCheckout is off", () => {
    const off = config(["SUPER_ADMIN"], ["SUPER_ADMIN"], false);
    for (const access of ["view", "edit"] as const) {
      expect(
        canAccessWebCheckoutCart(off, PagePermission.SUPER_ADMIN, access),
      ).toBe(false);
    }
  });

  it("separates view roles from edit roles and lets edit roles view", () => {
    const c = config(["SERVICES"], ["PA"]);
    expect(canAccessWebCheckoutCart(c, PagePermission.SERVICES, "view")).toBe(
      true,
    );
    expect(canAccessWebCheckoutCart(c, PagePermission.SERVICES, "edit")).toBe(
      false,
    );
    expect(canAccessWebCheckoutCart(c, PagePermission.PA, "view")).toBe(true);
    expect(canAccessWebCheckoutCart(c, PagePermission.PA, "edit")).toBe(true);
    expect(canAccessWebCheckoutCart(c, PagePermission.LIAISON, "view")).toBe(
      false,
    );
  });

  it("scopes to page contexts and never allows USER or a missing context", () => {
    const c = config(["PA", "SERVICES"], ["PA"]);
    expect(isWebCheckoutContextAllowed(c, PageContextLevel.PA, "edit")).toBe(
      true,
    );
    expect(
      isWebCheckoutContextAllowed(c, PageContextLevel.SERVICES, "view"),
    ).toBe(true);
    expect(
      isWebCheckoutContextAllowed(c, PageContextLevel.SERVICES, "edit"),
    ).toBe(false);
    expect(isWebCheckoutContextAllowed(c, PageContextLevel.ADMIN, "view")).toBe(
      false,
    );
    for (const access of ["view", "edit"] as const) {
      expect(
        isWebCheckoutContextAllowed(c, PageContextLevel.USER, access),
      ).toBe(false);
      expect(isWebCheckoutContextAllowed(c, undefined, access)).toBe(false);
    }
  });

  it("keeps the pre-config access under the default schema", () => {
    const { detailsModal } = generateDefaultSchema("mc");
    const can = (
      perm: PagePermission,
      ctx: PageContextLevel,
      access: "view" | "edit",
    ) =>
      isWebCheckoutContextAllowed(detailsModal, ctx, access) &&
      canAccessWebCheckoutCart(detailsModal, perm, access);

    expect(can(PagePermission.PA, PageContextLevel.PA, "edit")).toBe(true);
    expect(can(PagePermission.ADMIN, PageContextLevel.ADMIN, "edit")).toBe(
      true,
    );
    expect(
      can(PagePermission.SUPER_ADMIN, PageContextLevel.ADMIN, "edit"),
    ).toBe(true);
    expect(can(PagePermission.ADMIN, PageContextLevel.PA, "edit")).toBe(true);
    expect(
      can(PagePermission.SERVICES, PageContextLevel.SERVICES, "view"),
    ).toBe(false);
    expect(can(PagePermission.LIAISON, PageContextLevel.LIAISON, "view")).toBe(
      false,
    );
  });
});

describe("coerceTenantSchema detailsModal WebCheckout roles", () => {
  it("defaults both WebCheckout role lists when unset", () => {
    const out = coerceTenantSchema({ detailsModal: { showMemo: true } }, "mc");
    expect(out.detailsModal.webCheckoutViewRoles).toEqual([
      ...DEFAULT_WEBCHECKOUT_ROLES,
    ]);
    expect(out.detailsModal.webCheckoutEditRoles).toEqual([
      ...DEFAULT_WEBCHECKOUT_ROLES,
    ]);
  });

  it("normalizes stored lists and lets a tenant lock editing down to nobody", () => {
    const out = coerceTenantSchema(
      {
        detailsModal: {
          webCheckoutViewRoles: ["SERVICES", "bogus", "SERVICES"],
          webCheckoutEditRoles: [],
        },
      },
      "mc",
    );
    expect(out.detailsModal.webCheckoutViewRoles).toEqual(["SERVICES"]);
    expect(out.detailsModal.webCheckoutEditRoles).toEqual([]);
    expect(
      canAccessWebCheckoutCart(
        out.detailsModal,
        PagePermission.SUPER_ADMIN,
        "edit",
      ),
    ).toBe(false);
  });

  it("grants nobody when a stored list is malformed", () => {
    const out = coerceTenantSchema(
      { detailsModal: { webCheckoutEditRoles: "ADMIN" } },
      "mc",
    );
    expect(out.detailsModal.webCheckoutEditRoles).toEqual([]);
  });
});
