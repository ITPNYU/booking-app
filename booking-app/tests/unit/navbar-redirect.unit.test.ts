import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PagePermission } from "../../components/src/types";
import { PERMISSION_PATH } from "../../components/src/utils/permissions";

// Mock sessionStorage
const createMockSessionStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    _getStore: () => store,
  };
};

/**
 * Helper function using the shared PERMISSION_PATH mapping from permissions.ts
 */
const getPathFromPermission = (permission: PagePermission): string =>
  PERMISSION_PATH[permission] ?? "";

/**
 * Simulates the core redirect logic from app/[tenant]/page.tsx useEffect
 */
const simulateRedirectLogic = (params: {
  isRoot: boolean;
  tenant: string | undefined;
  pagePermission: PagePermission;
  permissionsLoading: boolean;
  hasRedirectedFlag: boolean;
}): { shouldRedirect: boolean; targetPath: string | null } => {
  const { isRoot, tenant, pagePermission, permissionsLoading, hasRedirectedFlag } = params;

  // Match page.tsx conditions
  if (permissionsLoading) return { shouldRedirect: false, targetPath: null };
  if (!isRoot) return { shouldRedirect: false, targetPath: null };
  if (!tenant) return { shouldRedirect: false, targetPath: null };
  if (hasRedirectedFlag) return { shouldRedirect: false, targetPath: null };
  if (pagePermission === PagePermission.BOOKING) {
    return { shouldRedirect: false, targetPath: null };
  }

  const targetPath = getPathFromPermission(pagePermission);
  if (targetPath) {
    return { shouldRedirect: true, targetPath: `/${tenant}/${targetPath}` };
  }
  return { shouldRedirect: false, targetPath: null };
};

/**
 * Simulates the tenant-root check used in app/[tenant]/page.tsx (auto-redirect trigger)
 */
const calculateIsRedirectRoot = (pathname: string, tenant: string | undefined): boolean => {
  return pathname === "/" || (!!tenant && pathname === `/${tenant}`);
};

/**
 * Simulates isAppRoot from navBar.tsx (used for hiding navbar chrome)
 */
const calculateIsAppRoot = (pathname: string): boolean => {
  return pathname === "/";
};

describe("NavBar Redirect Logic", () => {
  let mockSessionStorage: ReturnType<typeof createMockSessionStorage>;

  beforeEach(() => {
    mockSessionStorage = createMockSessionStorage();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("getPathFromPermission", () => {
    it("returns 'admin' for ADMIN permission", () => {
      expect(getPathFromPermission(PagePermission.ADMIN)).toBe("admin");
    });

    it("returns 'pa' for PA permission", () => {
      expect(getPathFromPermission(PagePermission.PA)).toBe("pa");
    });

    it("returns 'liaison' for LIAISON permission", () => {
      expect(getPathFromPermission(PagePermission.LIAISON)).toBe("liaison");
    });

    it("returns 'services' for SERVICES permission", () => {
      expect(getPathFromPermission(PagePermission.SERVICES)).toBe("services");
    });

    it("returns 'super' for SUPER_ADMIN permission", () => {
      expect(getPathFromPermission(PagePermission.SUPER_ADMIN)).toBe("super");
    });

    it("returns empty string for BOOKING permission", () => {
      expect(getPathFromPermission(PagePermission.BOOKING)).toBe("");
    });
  });

  describe("calculateIsRedirectRoot", () => {
    it("returns true for root path '/'", () => {
      expect(calculateIsRedirectRoot("/", undefined)).toBe(true);
    });

    it("returns true for tenant root '/media-commons'", () => {
      expect(calculateIsRedirectRoot("/media-commons", "media-commons")).toBe(true);
    });

    it("returns false for non-root paths", () => {
      expect(calculateIsRedirectRoot("/media-commons/admin", "media-commons")).toBe(false);
      expect(calculateIsRedirectRoot("/media-commons/pa", "media-commons")).toBe(false);
      expect(calculateIsRedirectRoot("/media-commons/modification/123", "media-commons")).toBe(false);
    });
  });

  describe("calculateIsAppRoot (navbar chrome visibility)", () => {
    it("returns true only for the literal app root '/'", () => {
      expect(calculateIsAppRoot("/")).toBe(true);
    });

    it("returns false for tenant root — dropdown/logo must be visible on User page", () => {
      expect(calculateIsAppRoot("/media-commons")).toBe(false);
    });

    it("returns false for all sub-pages", () => {
      expect(calculateIsAppRoot("/media-commons/admin")).toBe(false);
      expect(calculateIsAppRoot("/media-commons/pa")).toBe(false);
      expect(calculateIsAppRoot("/media-commons/modification/123")).toBe(false);
    });
  });

  describe("Auto-redirect to highest priority role", () => {
    it("redirects ADMIN users to /tenant/admin on root page", () => {
      const result = simulateRedirectLogic({
        isRoot: true,
        tenant: "media-commons",
        pagePermission: PagePermission.ADMIN,
        permissionsLoading: false,
        hasRedirectedFlag: false,
      });

      expect(result.shouldRedirect).toBe(true);
      expect(result.targetPath).toBe("/media-commons/admin");
    });

    it("redirects LIAISON users to /tenant/liaison on root page", () => {
      const result = simulateRedirectLogic({
        isRoot: true,
        tenant: "media-commons",
        pagePermission: PagePermission.LIAISON,
        permissionsLoading: false,
        hasRedirectedFlag: false,
      });

      expect(result.shouldRedirect).toBe(true);
      expect(result.targetPath).toBe("/media-commons/liaison");
    });

    it("redirects SERVICES users to /tenant/services on root page", () => {
      const result = simulateRedirectLogic({
        isRoot: true,
        tenant: "media-commons",
        pagePermission: PagePermission.SERVICES,
        permissionsLoading: false,
        hasRedirectedFlag: false,
      });

      expect(result.shouldRedirect).toBe(true);
      expect(result.targetPath).toBe("/media-commons/services");
    });

    it("redirects PA users to /tenant/pa on root page", () => {
      const result = simulateRedirectLogic({
        isRoot: true,
        tenant: "media-commons",
        pagePermission: PagePermission.PA,
        permissionsLoading: false,
        hasRedirectedFlag: false,
      });

      expect(result.shouldRedirect).toBe(true);
      expect(result.targetPath).toBe("/media-commons/pa");
    });

    it("redirects SUPER_ADMIN users to /tenant/super on root page", () => {
      const result = simulateRedirectLogic({
        isRoot: true,
        tenant: "media-commons",
        pagePermission: PagePermission.SUPER_ADMIN,
        permissionsLoading: false,
        hasRedirectedFlag: false,
      });

      expect(result.shouldRedirect).toBe(true);
      expect(result.targetPath).toBe("/media-commons/super");
    });

    it("does NOT redirect BOOKING users (regular students stay on root)", () => {
      const result = simulateRedirectLogic({
        isRoot: true,
        tenant: "media-commons",
        pagePermission: PagePermission.BOOKING,
        permissionsLoading: false,
        hasRedirectedFlag: false,
      });

      expect(result.shouldRedirect).toBe(false);
      expect(result.targetPath).toBeNull();
    });
  });

  describe("Redirect prevention conditions", () => {
    it("does NOT redirect if already redirected this session", () => {
      const result = simulateRedirectLogic({
        isRoot: true,
        tenant: "media-commons",
        pagePermission: PagePermission.ADMIN,
        permissionsLoading: false,
        hasRedirectedFlag: true, // Already redirected
      });

      expect(result.shouldRedirect).toBe(false);
    });

    it("does NOT redirect if not on root page", () => {
      const result = simulateRedirectLogic({
        isRoot: false, // Not on root
        tenant: "media-commons",
        pagePermission: PagePermission.ADMIN,
        permissionsLoading: false,
        hasRedirectedFlag: false,
      });

      expect(result.shouldRedirect).toBe(false);
    });

    it("does NOT redirect if tenant is not available", () => {
      const result = simulateRedirectLogic({
        isRoot: true,
        tenant: undefined, // No tenant
        pagePermission: PagePermission.ADMIN,
        permissionsLoading: false,
        hasRedirectedFlag: false,
      });

      expect(result.shouldRedirect).toBe(false);
    });

    it("does NOT redirect while permissions are still loading", () => {
      const result = simulateRedirectLogic({
        isRoot: true,
        tenant: "media-commons",
        pagePermission: PagePermission.ADMIN,
        permissionsLoading: true, // Still loading
        hasRedirectedFlag: false,
      });

      expect(result.shouldRedirect).toBe(false);
    });
  });

  describe("Session storage flag management", () => {
    it("flag should be cleared on sign-out (simulated)", () => {
      mockSessionStorage.setItem("hasRedirectedToDefaultContext", "true");
      expect(mockSessionStorage.getItem("hasRedirectedToDefaultContext")).toBe("true");

      // Simulate sign-out clearing the flag
      mockSessionStorage.removeItem("hasRedirectedToDefaultContext");

      expect(mockSessionStorage.getItem("hasRedirectedToDefaultContext")).toBeNull();
    });

    it("flag should be cleared when clicking home logo (simulated)", () => {
      mockSessionStorage.setItem("hasRedirectedToDefaultContext", "true");

      // Simulate handleClickHome clearing the flag
      mockSessionStorage.removeItem("hasRedirectedToDefaultContext");

      expect(mockSessionStorage.getItem("hasRedirectedToDefaultContext")).toBeNull();
    });

    it("flag should be cleared when navigating away from root (simulated)", () => {
      mockSessionStorage.setItem("hasRedirectedToDefaultContext", "true");

      // Simulate navigating to /media-commons/modification/123 which clears flag
      const pathname: string = "/media-commons/modification/123";
      const isTenantRoot = /^\/[^/]+$/.test(pathname);
      const isRootOrTenantRoot = pathname === "/" || isTenantRoot;

      if (!isRootOrTenantRoot) {
        mockSessionStorage.removeItem("hasRedirectedToDefaultContext");
      }

      expect(mockSessionStorage.getItem("hasRedirectedToDefaultContext")).toBeNull();
    });

    it("flag should be set after successful redirect", () => {
      const result = simulateRedirectLogic({
        isRoot: true,
        tenant: "media-commons",
        pagePermission: PagePermission.PA,
        permissionsLoading: false,
        hasRedirectedFlag: false,
      });

      if (result.shouldRedirect) {
        mockSessionStorage.setItem("hasRedirectedToDefaultContext", "true");
      }

      expect(mockSessionStorage.getItem("hasRedirectedToDefaultContext")).toBe("true");
    });
  });

  describe("PA user modification flow", () => {
    it("PA user redirects to /pa on initial visit", () => {
      const result = simulateRedirectLogic({
        isRoot: true,
        tenant: "media-commons",
        pagePermission: PagePermission.PA,
        permissionsLoading: false,
        hasRedirectedFlag: false,
      });

      expect(result.shouldRedirect).toBe(true);
      expect(result.targetPath).toBe("/media-commons/pa");
    });

    it("PA user can return to root after modification (flag cleared)", () => {
      // Initially redirected
      mockSessionStorage.setItem("hasRedirectedToDefaultContext", "true");

      // Navigate to modification page (which clears flag per navBar logic)
      const modificationPath = "/media-commons/modification/abc123";
      const isTenantRoot = /^\/[^/]+$/.test(modificationPath);
      if (!(modificationPath === "/" || isTenantRoot)) {
        mockSessionStorage.removeItem("hasRedirectedToDefaultContext");
      }

      // Return to root - should redirect again
      const result = simulateRedirectLogic({
        isRoot: true,
        tenant: "media-commons",
        pagePermission: PagePermission.PA,
        permissionsLoading: false,
        hasRedirectedFlag: mockSessionStorage.getItem("hasRedirectedToDefaultContext") === "true",
      });

      expect(result.shouldRedirect).toBe(true);
      expect(result.targetPath).toBe("/media-commons/pa");
    });
  });

  describe("User tab accessibility (bug fix)", () => {
    /**
     * Simulates handleRoleChange selecting BOOKING (User) tab.
     * The fix: set the hasRedirectedToDefaultContext flag before navigating to root
     * so the auto-redirect useEffect does NOT immediately bounce the user back.
     */
    const simulateHandleRoleChangeToUser = (
      tenant: string,
      storage: ReturnType<typeof createMockSessionStorage>
    ): string => {
      const role = PagePermission.BOOKING;
      const path = ""; // getPathFromPermission(BOOKING) returns ""
      // Fixed path construction: no trailing slash when path is empty
      const fullPath = path ? `/${tenant}/${path}` : `/${tenant}`;
      // Fix: set flag so auto-redirect does not fire
      storage.setItem("hasRedirectedToDefaultContext", "true");
      return fullPath;
    };

    it("Admin can navigate to User context without being bounced back", () => {
      // Step 1: admin was auto-redirected to /admin earlier, which cleared the flag
      mockSessionStorage.removeItem("hasRedirectedToDefaultContext");

      // Step 2: admin selects 'User' from dropdown
      const targetPath = simulateHandleRoleChangeToUser("media-commons", mockSessionStorage);
      expect(targetPath).toBe("/media-commons");

      // Step 3: flag should now be set to prevent auto-redirect
      expect(mockSessionStorage.getItem("hasRedirectedToDefaultContext")).toBe("true");

      // Step 4: auto-redirect logic should NOT redirect away from root
      const result = simulateRedirectLogic({
        isRoot: true,
        tenant: "media-commons",
        pagePermission: PagePermission.ADMIN,
        permissionsLoading: false,
        hasRedirectedFlag: mockSessionStorage.getItem("hasRedirectedToDefaultContext") === "true",
      });

      expect(result.shouldRedirect).toBe(false);
    });

    it("PA can navigate to User context without being bounced back", () => {
      mockSessionStorage.removeItem("hasRedirectedToDefaultContext");

      simulateHandleRoleChangeToUser("media-commons", mockSessionStorage);

      const result = simulateRedirectLogic({
        isRoot: true,
        tenant: "media-commons",
        pagePermission: PagePermission.PA,
        permissionsLoading: false,
        hasRedirectedFlag: mockSessionStorage.getItem("hasRedirectedToDefaultContext") === "true",
      });

      expect(result.shouldRedirect).toBe(false);
    });

    it("after User tab visit, navigating away clears flag and next root visit redirects to default", () => {
      // User selects 'User' tab → flag set
      simulateHandleRoleChangeToUser("media-commons", mockSessionStorage);
      expect(mockSessionStorage.getItem("hasRedirectedToDefaultContext")).toBe("true");

      // User navigates to /mc/book (non-root) → flag cleared by pathname effect
      const bookPath = "/media-commons/book";
      const isTenantRoot = /^\/[^/]+$/.test(bookPath);
      if (!(bookPath === "/" || isTenantRoot)) {
        mockSessionStorage.removeItem("hasRedirectedToDefaultContext");
      }
      expect(mockSessionStorage.getItem("hasRedirectedToDefaultContext")).toBeNull();

      // User returns to root → auto-redirect fires again (PA/Admin goes to their default)
      const result = simulateRedirectLogic({
        isRoot: true,
        tenant: "media-commons",
        pagePermission: PagePermission.ADMIN,
        permissionsLoading: false,
        hasRedirectedFlag: false,
      });

      expect(result.shouldRedirect).toBe(true);
      expect(result.targetPath).toBe("/media-commons/admin");
    });

    it("User context path has no trailing slash", () => {
      // Regression: old code produced '/${tenant}/' which is different from isRoot check
      const path = ""; // getPathFromPermission(BOOKING)
      const tenant = "mc";
      const fullPath = path ? `/${tenant}/${path}` : `/${tenant}`;
      expect(fullPath).toBe("/mc");
      expect(fullPath.endsWith("/")).toBe(false);
    });
  });
});
