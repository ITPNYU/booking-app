import { render, screen, waitFor } from "@testing-library/react";
import { useParams, useRouter } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TenantEntitlementGuard from "@/components/src/client/routes/components/TenantEntitlementGuard";

// Override the global next/navigation mock so we control the router instance.
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
  usePathname: vi.fn(() => "/"),
}));

vi.mock(
  "@/components/src/client/routes/components/AuthProvider",
  () => ({ useAuth: vi.fn() })
);

import { useAuth } from "@/components/src/client/routes/components/AuthProvider";

const mockUseAuth = vi.mocked(useAuth);
const mockUseParams = vi.mocked(useParams);
const mockUseRouter = vi.mocked(useRouter);

// Shared router spy — reused across all tests; cleared in afterEach.
const mockReplace = vi.fn();

const mockUser = {
  email: "ab1234@nyu.edu",
  getIdToken: vi.fn().mockResolvedValue("mock-id-token"),
} as any;

const makeOkFetch = (tenants: string[]) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({ entitledTenants: tenants }),
  } as Response);

const makeErrorFetch = (status = 503) =>
  Promise.resolve({
    ok: false,
    status,
    json: async () => ({}),
  } as Response);

beforeEach(() => {
  mockUseRouter.mockReturnValue({ replace: mockReplace, push: vi.fn(), back: vi.fn() } as any);
  mockUseAuth.mockReturnValue({ user: mockUser, loading: false, isOnTestEnv: false, error: null });
  // Default: user is entitled to mc only.
  vi.mocked(global.fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ entitledTenants: ["mc"] }),
  } as Response);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------

describe("TenantEntitlementGuard", () => {
  describe("entitled user", () => {
    it("renders children when the user is entitled to the current tenant", async () => {
      mockUseParams.mockReturnValue({ tenant: "mc" });
      vi.mocked(global.fetch).mockResolvedValue(await makeOkFetch(["mc"]));

      render(
        <TenantEntitlementGuard>
          <div>Protected content</div>
        </TenantEntitlementGuard>
      );

      await waitFor(() => screen.getByText("Protected content"));
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("canonicalizes mediaCommons to mc and renders children", async () => {
      mockUseParams.mockReturnValue({ tenant: "mediaCommons" });
      vi.mocked(global.fetch).mockResolvedValue(await makeOkFetch(["mc"]));

      render(
        <TenantEntitlementGuard>
          <div>MC content</div>
        </TenantEntitlementGuard>
      );

      await waitFor(() => screen.getByText("MC content"));
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("renders children when the user is entitled to itp and visiting /itp", async () => {
      mockUseParams.mockReturnValue({ tenant: "itp" });
      vi.mocked(global.fetch).mockResolvedValue(await makeOkFetch(["mc", "itp"]));

      render(
        <TenantEntitlementGuard>
          <div>ITP content</div>
        </TenantEntitlementGuard>
      );

      await waitFor(() => screen.getByText("ITP content"));
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("sends the Firebase ID token in the Authorization header", async () => {
      mockUseParams.mockReturnValue({ tenant: "mc" });
      const fetchSpy = vi.mocked(global.fetch).mockResolvedValue(
        await makeOkFetch(["mc"])
      );

      render(
        <TenantEntitlementGuard>
          <div>Content</div>
        </TenantEntitlementGuard>
      );

      await waitFor(() => screen.getByText("Content"));
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/nyu/entitlements/ab1234"),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: "Bearer mock-id-token" }),
        })
      );
    });
  });

  // ---------------------------------------------------------------------------

  describe("non-entitled user", () => {
    it("redirects to / when the tenant is not in the user's entitlements", async () => {
      mockUseParams.mockReturnValue({ tenant: "itp" });
      vi.mocked(global.fetch).mockResolvedValue(
        await makeOkFetch(["mc"]) // mc only — itp not granted
      );

      render(
        <TenantEntitlementGuard>
          <div>ITP content</div>
        </TenantEntitlementGuard>
      );

      await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
      expect(screen.queryByText("ITP content")).not.toBeInTheDocument();
    });

    it("does not render children when redirecting", async () => {
      mockUseParams.mockReturnValue({ tenant: "itp" });
      vi.mocked(global.fetch).mockResolvedValue(await makeOkFetch(["mc"]));

      const { container } = render(
        <TenantEntitlementGuard>
          <div data-testid="child">Child</div>
        </TenantEntitlementGuard>
      );

      await waitFor(() => expect(mockReplace).toHaveBeenCalled());
      expect(container).toBeEmptyDOMElement();
    });
  });

  // ---------------------------------------------------------------------------

  describe("error handling — fail open", () => {
    it("renders children when the entitlements API returns a non-ok response", async () => {
      mockUseParams.mockReturnValue({ tenant: "itp" });
      vi.mocked(global.fetch).mockResolvedValue(makeErrorFetch(503));

      render(
        <TenantEntitlementGuard>
          <div>Fallback content</div>
        </TenantEntitlementGuard>
      );

      await waitFor(() => screen.getByText("Fallback content"));
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("renders children when fetch throws a network error", async () => {
      mockUseParams.mockReturnValue({ tenant: "itp" });
      vi.mocked(global.fetch).mockRejectedValue(new Error("network failure"));

      render(
        <TenantEntitlementGuard>
          <div>Fallback content</div>
        </TenantEntitlementGuard>
      );

      await waitFor(() => screen.getByText("Fallback content"));
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------

  describe("test environment bypass", () => {
    it("skips the entitlements fetch and renders children when isOnTestEnv is true", async () => {
      mockUseParams.mockReturnValue({ tenant: "itp" });
      mockUseAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        isOnTestEnv: true,
        error: null,
      });
      const fetchSpy = vi.mocked(global.fetch);

      render(
        <TenantEntitlementGuard>
          <div>Test env content</div>
        </TenantEntitlementGuard>
      );

      await waitFor(() => screen.getByText("Test env content"));
      expect(fetchSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("/api/nyu/entitlements"),
        expect.anything()
      );
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------

  describe("loading states", () => {
    it("shows a spinner and hides children while auth is loading", () => {
      mockUseParams.mockReturnValue({ tenant: "mc" });
      mockUseAuth.mockReturnValue({ user: null, loading: true, isOnTestEnv: false, error: null });

      render(
        <TenantEntitlementGuard>
          <div>Content</div>
        </TenantEntitlementGuard>
      );

      expect(screen.getByRole("progressbar")).toBeInTheDocument();
      expect(screen.queryByText("Content")).not.toBeInTheDocument();
    });

    it("shows a spinner while the entitlements check is in flight", async () => {
      mockUseParams.mockReturnValue({ tenant: "mc" });
      // Fetch that never resolves — guard stays in loading state.
      vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}));

      render(
        <TenantEntitlementGuard>
          <div>Content</div>
        </TenantEntitlementGuard>
      );

      await waitFor(() =>
        expect(screen.getByRole("progressbar")).toBeInTheDocument()
      );
      expect(screen.queryByText("Content")).not.toBeInTheDocument();
    });
  });
});
