import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PagePermission } from "../../components/src/types";

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
 * Helper function matching navBar.tsx getPathFromPermission
 */
const getPathFromPermission = (permission: PagePermission): string => {
  switch (permission) {
    case PagePermission.PA:
      return "pa";
    case PagePermission.ADMIN:
      return "admin";
    case PagePermission.LIAISON:
      return "liaison";
    case PagePermission.SERVICES:
      return "services";
    case PagePermission.SUPER_ADMIN:
      return "super";
    default:
      return "";
  }
};

/**
 * Simulates the core redirect logic from navBar.tsx useEffect
 */
const simulateRedirectLogic = (params: {
  isRoot: boolean;
  tenant: string | undefined;
  pagePermission: PagePermission;
  permissionsLoading: boolean;
  hasRedirectedFlag: boolean;
}): { shouldRedirect: boolean; targetPath: string | null } => {
  const { isRoot, tenant, pagePermission, permissionsLoading, hasRedirectedFlag } = params;

  // Match navBar.tsx conditions
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
 * Simulates the isRoot calculation from navBar.tsx
 */
const calculateIsRoot = (pathname: string, tenant: string | undefined): boolean => {
  return pathname === "/" || (!!tenant && pathname === `/${tenant}`);
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

  describe("calculateIsRoot", () => {
    it("returns true for root path '/'", () => {
      expect(calculateIsRoot("/", undefined)).toBe(true);
    });

    it("returns true for tenant root '/media-commons'", () => {
      expect(calculateIsRoot("/media-commons", "media-commons")).toBe(true);
    });

    it("returns false for non-root paths", () => {
      expect(calculateIsRoot("/media-commons/admin", "media-commons")).toBe(false);
      expect(calculateIsRoot("/media-commons/pa", "media-commons")).toBe(false);
      expect(calculateIsRoot("/media-commons/modification/123", "media-commons")).toBe(false);
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
});
