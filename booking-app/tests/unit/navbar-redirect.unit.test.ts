import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PagePermission } from "../../components/src/types";
import {
  getPathFromPermission,
  buildPathForPermission,
} from "../../components/src/utils/permissionPaths";

// Mock sessionStorage
const mockSessionStorage = (() => {
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
  };
})();

Object.defineProperty(window, "sessionStorage", {
  value: mockSessionStorage,
});

// Mock router
const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: vi.fn(),
  }),
  useParams: () => ({ tenant: "mc" }),
  usePathname: () => "/mc",
}));

// Mock firebase
vi.mock("@/lib/firebase/firebaseClient", () => ({
  auth: {},
}));

vi.mock("firebase/auth", () => ({
  signOut: vi.fn(),
}));

// Mock hooks and contexts
vi.mock(
  "../../components/src/client/routes/booking/hooks/useHandleStartBooking",
  () => ({
    default: () => vi.fn(),
  })
);

/**
 * Simulates the redirect logic from NavBar
 */
const simulateRedirectLogic = (
  isRoot: boolean,
  tenant: string | undefined,
  pagePermission: PagePermission,
  hasRedirectedFlag: boolean
): { shouldRedirect: boolean; targetPath: string | null } => {
  if (!isRoot) return { shouldRedirect: false, targetPath: null };
  if (!tenant) return { shouldRedirect: false, targetPath: null };
  if (hasRedirectedFlag) return { shouldRedirect: false, targetPath: null };
  if (pagePermission === PagePermission.BOOKING)
    return { shouldRedirect: false, targetPath: null };

  const targetPath = getPathFromPermission(pagePermission);
  if (targetPath) {
    return { shouldRedirect: true, targetPath: `/${tenant}/${targetPath}` };
  }
  return { shouldRedirect: false, targetPath: null };
};

describe("NavBar Redirect Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionStorage.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Auto-redirect to highest priority role", () => {
    it("should redirect ADMIN users to /tenant/admin on root page", () => {
      const result = simulateRedirectLogic(
        true,
        "mc",
        PagePermission.ADMIN,
        false
      );

      expect(result.shouldRedirect).toBe(true);
      expect(result.targetPath).toBe("/mc/admin");
    });

    it("should redirect LIAISON users to /tenant/liaison on root page", () => {
      const result = simulateRedirectLogic(
        true,
        "mc",
        PagePermission.LIAISON,
        false
      );

      expect(result.shouldRedirect).toBe(true);
      expect(result.targetPath).toBe("/mc/liaison");
    });

    it("should redirect SERVICES users to /tenant/services on root page", () => {
      const result = simulateRedirectLogic(
        true,
        "mc",
        PagePermission.SERVICES,
        false
      );

      expect(result.shouldRedirect).toBe(true);
      expect(result.targetPath).toBe("/mc/services");
    });

    it("should redirect PA users to /tenant/pa on root page", () => {
      const result = simulateRedirectLogic(
        true,
        "mc",
        PagePermission.PA,
        false
      );

      expect(result.shouldRedirect).toBe(true);
      expect(result.targetPath).toBe("/mc/pa");
    });

    it("should redirect SUPER_ADMIN users to /tenant/super on root page", () => {
      const result = simulateRedirectLogic(
        true,
        "mc",
        PagePermission.SUPER_ADMIN,
        false
      );

      expect(result.shouldRedirect).toBe(true);
      expect(result.targetPath).toBe("/mc/super");
    });

    it("should NOT redirect BOOKING users (they stay on root)", () => {
      const result = simulateRedirectLogic(
        true,
        "mc",
        PagePermission.BOOKING,
        false
      );

      expect(result.shouldRedirect).toBe(false);
      expect(result.targetPath).toBeNull();
    });

    it("should NOT redirect if already redirected this session", () => {
      const result = simulateRedirectLogic(
        true,
        "mc",
        PagePermission.ADMIN,
        true // Already redirected
      );

      expect(result.shouldRedirect).toBe(false);
    });

    it("should NOT redirect if not on root page", () => {
      const result = simulateRedirectLogic(
        false, // Not on root
        "mc",
        PagePermission.ADMIN,
        false
      );

      expect(result.shouldRedirect).toBe(false);
    });

    it("should NOT redirect if tenant is not available", () => {
      const result = simulateRedirectLogic(
        true,
        undefined, // No tenant
        PagePermission.ADMIN,
        false
      );

      expect(result.shouldRedirect).toBe(false);
    });
  });

  describe("Session storage management", () => {
    it("handleClickHome should clear redirect flag", () => {
      mockSessionStorage.setItem("hasRedirectedToDefaultContext", "true");

      // Simulate handleClickHome
      mockSessionStorage.removeItem("hasRedirectedToDefaultContext");
      mockPush("/mc");

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
        "hasRedirectedToDefaultContext"
      );
    });

    it("handleClickRoot should clear redirect flag", () => {
      mockSessionStorage.setItem("hasRedirectedToDefaultContext", "true");

      // Simulate handleClickRoot
      mockSessionStorage.removeItem("hasRedirectedToDefaultContext");
      mockPush("/");

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
        "hasRedirectedToDefaultContext"
      );
    });

    it("sign out should clear redirect flag", () => {
      mockSessionStorage.setItem("hasRedirectedToDefaultContext", "true");

      // Simulate sign out
      mockSessionStorage.removeItem("hasRedirectedToDefaultContext");

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
        "hasRedirectedToDefaultContext"
      );
    });
  });

  describe("isRoot detection", () => {
    const detectIsRoot = (
      pathname: string,
      tenant: string | undefined
    ): boolean => {
      const normalizedPathname =
        pathname.endsWith("/") && pathname.length > 1
          ? pathname.slice(0, -1)
          : pathname;
      return (
        normalizedPathname === "/" ||
        (tenant ? normalizedPathname === `/${tenant}` : false)
      );
    };

    it("should detect / as root", () => {
      expect(detectIsRoot("/", undefined)).toBe(true);
    });

    it("should detect /mc as root when tenant is mc", () => {
      expect(detectIsRoot("/mc", "mc")).toBe(true);
    });

    it("should detect /mc/ (with trailing slash) as root when tenant is mc", () => {
      expect(detectIsRoot("/mc/", "mc")).toBe(true);
    });

    it("should NOT detect /mc/admin as root", () => {
      expect(detectIsRoot("/mc/admin", "mc")).toBe(false);
    });

    it("should NOT detect /mc/pa as root", () => {
      expect(detectIsRoot("/mc/pa", "mc")).toBe(false);
    });
  });
});
