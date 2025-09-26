import { describe, expect, it } from "vitest";
import { PagePermission } from "../../components/src/types";
import {
  canAccessAdmin,
  canAccessWebCheckout,
  hasAnyPermission,
  hasMinimumPermission,
  hasPermission,
} from "../../components/src/utils/permissions";

describe("Permissions Utility", () => {
  describe("hasPermission", () => {
    it("SUPER_ADMIN should have all permissions", () => {
      const permissions = [
        PagePermission.SUPER_ADMIN,
        PagePermission.ADMIN,
        PagePermission.PA,
        PagePermission.LIAISON,
        PagePermission.STAFFING,
        PagePermission.BOOKING,
      ];

      permissions.forEach((permission) => {
        expect(hasPermission(PagePermission.SUPER_ADMIN, permission)).toBe(
          true
        );
      });
    });

    it("ADMIN should have admin and below permissions", () => {
      const allowedPermissions = [
        PagePermission.ADMIN,
        PagePermission.PA,
        PagePermission.LIAISON,
        PagePermission.STAFFING,
        PagePermission.BOOKING,
      ];

      allowedPermissions.forEach((permission) => {
        expect(hasPermission(PagePermission.ADMIN, permission)).toBe(true);
      });

      expect(
        hasPermission(PagePermission.ADMIN, PagePermission.SUPER_ADMIN)
      ).toBe(false);
    });

    it("PA should only have PA and BOOKING permissions", () => {
      expect(hasPermission(PagePermission.PA, PagePermission.PA)).toBe(true);
      expect(hasPermission(PagePermission.PA, PagePermission.BOOKING)).toBe(
        true
      );

      const deniedPermissions = [
        PagePermission.SUPER_ADMIN,
        PagePermission.ADMIN,
        PagePermission.LIAISON,
        PagePermission.STAFFING,
      ];

      deniedPermissions.forEach((permission) => {
        expect(hasPermission(PagePermission.PA, permission)).toBe(false);
      });
    });

    it("LIAISON should only have LIAISON and BOOKING permissions", () => {
      expect(
        hasPermission(PagePermission.LIAISON, PagePermission.LIAISON)
      ).toBe(true);
      expect(
        hasPermission(PagePermission.LIAISON, PagePermission.BOOKING)
      ).toBe(true);

      const deniedPermissions = [
        PagePermission.SUPER_ADMIN,
        PagePermission.ADMIN,
        PagePermission.PA,
        PagePermission.STAFFING,
      ];

      deniedPermissions.forEach((permission) => {
        expect(hasPermission(PagePermission.LIAISON, permission)).toBe(false);
      });
    });

    it("STAFFING should only have STAFFING and BOOKING permissions", () => {
      expect(
        hasPermission(PagePermission.STAFFING, PagePermission.STAFFING)
      ).toBe(true);
      expect(
        hasPermission(PagePermission.STAFFING, PagePermission.BOOKING)
      ).toBe(true);

      const deniedPermissions = [
        PagePermission.SUPER_ADMIN,
        PagePermission.ADMIN,
        PagePermission.PA,
        PagePermission.LIAISON,
      ];

      deniedPermissions.forEach((permission) => {
        expect(hasPermission(PagePermission.STAFFING, permission)).toBe(false);
      });
    });

    it("BOOKING should only have BOOKING permission", () => {
      expect(
        hasPermission(PagePermission.BOOKING, PagePermission.BOOKING)
      ).toBe(true);

      const deniedPermissions = [
        PagePermission.SUPER_ADMIN,
        PagePermission.ADMIN,
        PagePermission.PA,
        PagePermission.LIAISON,
        PagePermission.STAFFING,
      ];

      deniedPermissions.forEach((permission) => {
        expect(hasPermission(PagePermission.BOOKING, permission)).toBe(false);
      });
    });
  });

  describe("hasAnyPermission", () => {
    it("should return true if user has any of the required permissions", () => {
      expect(
        hasAnyPermission(PagePermission.PA, [
          PagePermission.PA,
          PagePermission.ADMIN,
        ])
      ).toBe(true);

      expect(
        hasAnyPermission(PagePermission.ADMIN, [
          PagePermission.PA,
          PagePermission.LIAISON,
        ])
      ).toBe(true); // ADMIN has both PA and LIAISON permissions
    });

    it("should return false if user has none of the required permissions", () => {
      expect(
        hasAnyPermission(PagePermission.BOOKING, [
          PagePermission.PA,
          PagePermission.ADMIN,
        ])
      ).toBe(false);

      expect(
        hasAnyPermission(PagePermission.PA, [
          PagePermission.ADMIN,
          PagePermission.SUPER_ADMIN,
        ])
      ).toBe(false);
    });
  });

  describe("canAccessWebCheckout", () => {
    it("should allow access for PA, STAFFING, ADMIN and SUPER_ADMIN", () => {
      expect(canAccessWebCheckout(PagePermission.PA)).toBe(true);
      expect(canAccessWebCheckout(PagePermission.STAFFING)).toBe(true);
      expect(canAccessWebCheckout(PagePermission.ADMIN)).toBe(true);
      expect(canAccessWebCheckout(PagePermission.SUPER_ADMIN)).toBe(true);
    });

    it("should deny access for BOOKING and LIAISON", () => {
      expect(canAccessWebCheckout(PagePermission.BOOKING)).toBe(false);
      expect(canAccessWebCheckout(PagePermission.LIAISON)).toBe(false);
    });
  });

  describe("canAccessAdmin", () => {
    it("should allow ADMIN and SUPER_ADMIN users", () => {
      expect(canAccessAdmin(PagePermission.ADMIN)).toBe(true);
      expect(canAccessAdmin(PagePermission.SUPER_ADMIN)).toBe(true);
    });

    it("should deny PA, BOOKING, LIAISON, and EQUIPMENT users", () => {
      expect(canAccessAdmin(PagePermission.PA)).toBe(false);
      expect(canAccessAdmin(PagePermission.BOOKING)).toBe(false);
      expect(canAccessAdmin(PagePermission.LIAISON)).toBe(false);
      expect(canAccessAdmin(PagePermission.STAFFING)).toBe(false);
    });
  });

  describe("hasMinimumPermission", () => {
    it("should work correctly for permission hierarchy", () => {
      // SUPER_ADMIN should have minimum permission of any level
      expect(
        hasMinimumPermission(PagePermission.SUPER_ADMIN, PagePermission.BOOKING)
      ).toBe(true);
      expect(
        hasMinimumPermission(PagePermission.SUPER_ADMIN, PagePermission.PA)
      ).toBe(true);
      expect(
        hasMinimumPermission(PagePermission.SUPER_ADMIN, PagePermission.ADMIN)
      ).toBe(true);

      // ADMIN should have minimum permission of ADMIN and below
      expect(
        hasMinimumPermission(PagePermission.ADMIN, PagePermission.BOOKING)
      ).toBe(true);
      expect(
        hasMinimumPermission(PagePermission.ADMIN, PagePermission.PA)
      ).toBe(true);
      expect(
        hasMinimumPermission(PagePermission.ADMIN, PagePermission.ADMIN)
      ).toBe(true);
      expect(
        hasMinimumPermission(PagePermission.ADMIN, PagePermission.SUPER_ADMIN)
      ).toBe(false);

      // PA should only have minimum permission of PA and BOOKING
      expect(
        hasMinimumPermission(PagePermission.PA, PagePermission.BOOKING)
      ).toBe(true);
      expect(hasMinimumPermission(PagePermission.PA, PagePermission.PA)).toBe(
        true
      );
      expect(
        hasMinimumPermission(PagePermission.PA, PagePermission.ADMIN)
      ).toBe(false);
    });
  });
});
