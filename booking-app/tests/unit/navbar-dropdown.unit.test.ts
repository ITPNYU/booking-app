import { describe, expect, it } from "vitest";
import { PagePermission } from "../../components/src/types";

/**
 * Tests for the NavBar dropdown visibility logic.
 * The dropdown should only appear for users with elevated permissions.
 */
describe("NavBar Dropdown Visibility", () => {
  // Helper function that mirrors the logic in navBar.tsx
  const hasUserPermission = (
    pagePermission: PagePermission,
    roles: PagePermission[]
  ) => {
    return roles.includes(pagePermission);
  };

  // Helper function to determine if dropdown should be shown
  const shouldShowDropdown = (pagePermission: PagePermission): boolean => {
    return hasUserPermission(pagePermission, [
      PagePermission.ADMIN,
      PagePermission.PA,
      PagePermission.LIAISON,
      PagePermission.SERVICES,
      PagePermission.SUPER_ADMIN,
    ]);
  };

  describe("Dropdown visibility check", () => {
    it("should show dropdown for SUPER_ADMIN users", () => {
      expect(shouldShowDropdown(PagePermission.SUPER_ADMIN)).toBe(true);
    });

    it("should show dropdown for ADMIN users", () => {
      expect(shouldShowDropdown(PagePermission.ADMIN)).toBe(true);
    });

    it("should show dropdown for LIAISON users", () => {
      expect(shouldShowDropdown(PagePermission.LIAISON)).toBe(true);
    });

    it("should show dropdown for SERVICES users", () => {
      expect(shouldShowDropdown(PagePermission.SERVICES)).toBe(true);
    });

    it("should show dropdown for PA users", () => {
      expect(shouldShowDropdown(PagePermission.PA)).toBe(true);
    });

    it("should NOT show dropdown for BOOKING users", () => {
      expect(shouldShowDropdown(PagePermission.BOOKING)).toBe(false);
    });
  });

  describe("Menu item visibility", () => {
    // Helper to determine which menu items should be shown
    const getVisibleMenuItems = (pagePermission: PagePermission) => {
      const items: string[] = ["User"]; // User is always visible

      const showPA = hasUserPermission(pagePermission, [
        PagePermission.PA,
        PagePermission.ADMIN,
        PagePermission.SUPER_ADMIN,
      ]);

      const showLiaison = hasUserPermission(pagePermission, [
        PagePermission.LIAISON,
        PagePermission.ADMIN,
        PagePermission.SUPER_ADMIN,
      ]);

      const showAdmin = hasUserPermission(pagePermission, [
        PagePermission.ADMIN,
        PagePermission.SUPER_ADMIN,
      ]);

      const showServices = hasUserPermission(pagePermission, [
        PagePermission.SERVICES,
        PagePermission.ADMIN,
        PagePermission.SUPER_ADMIN,
      ]);

      const showSuperAdmin = hasUserPermission(pagePermission, [
        PagePermission.SUPER_ADMIN,
      ]);

      if (showPA) items.push("PA");
      if (showLiaison) items.push("Liaison");
      if (showServices) items.push("Services");
      if (showAdmin) items.push("Admin");
      if (showSuperAdmin) items.push("Super");

      return items;
    };

    it("SUPER_ADMIN should see all menu items", () => {
      const items = getVisibleMenuItems(PagePermission.SUPER_ADMIN);
      expect(items).toContain("User");
      expect(items).toContain("PA");
      expect(items).toContain("Liaison");
      expect(items).toContain("Services");
      expect(items).toContain("Admin");
      expect(items).toContain("Super");
    });

    it("ADMIN should see User, PA, Liaison, Services, Admin but NOT Super", () => {
      const items = getVisibleMenuItems(PagePermission.ADMIN);
      expect(items).toContain("User");
      expect(items).toContain("PA");
      expect(items).toContain("Liaison");
      expect(items).toContain("Services");
      expect(items).toContain("Admin");
      expect(items).not.toContain("Super");
    });

    it("LIAISON should see only User and Liaison", () => {
      const items = getVisibleMenuItems(PagePermission.LIAISON);
      expect(items).toContain("User");
      expect(items).toContain("Liaison");
      expect(items).not.toContain("PA");
      expect(items).not.toContain("Services");
      expect(items).not.toContain("Admin");
      expect(items).not.toContain("Super");
    });

    it("SERVICES should see only User and Services", () => {
      const items = getVisibleMenuItems(PagePermission.SERVICES);
      expect(items).toContain("User");
      expect(items).toContain("Services");
      expect(items).not.toContain("PA");
      expect(items).not.toContain("Liaison");
      expect(items).not.toContain("Admin");
      expect(items).not.toContain("Super");
    });

    it("PA should see only User and PA", () => {
      const items = getVisibleMenuItems(PagePermission.PA);
      expect(items).toContain("User");
      expect(items).toContain("PA");
      expect(items).not.toContain("Liaison");
      expect(items).not.toContain("Services");
      expect(items).not.toContain("Admin");
      expect(items).not.toContain("Super");
    });

    it("BOOKING should see only User", () => {
      const items = getVisibleMenuItems(PagePermission.BOOKING);
      expect(items).toEqual(["User"]);
    });
  });
});
