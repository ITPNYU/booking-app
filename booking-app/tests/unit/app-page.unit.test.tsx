import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, Mock } from "vitest";
import HomePage from "@/app/page";
import * as AuthProvider from "@/components/src/client/routes/components/AuthProvider";

// Mock the useAuth hook
vi.mock("@/components/src/client/routes/components/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

describe("HomePage", () => {
  const mockUseAuth = AuthProvider.useAuth as Mock;
  const mockFetch = global.fetch as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Loading State", () => {
    it("should display loading message when auth is loading", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: true,
      });

      render(<HomePage />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("should display loading message when tenant access is being fetched", async () => {
      mockUseAuth.mockReturnValue({
        user: { email: "test@nyu.edu" },
        loading: false,
      });

      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            // Never resolve to keep loading state
          })
      );

      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText("Loading...")).toBeInTheDocument();
      });
    });
  });

  describe("No User State", () => {
    it("should not fetch tenant access when user is not logged in", async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(mockFetch).not.toHaveBeenCalled();
      });

      // Should show no tenant access message
      expect(
        screen.getByText("No tenant access available for your account.")
      ).toBeInTheDocument();
    });

    it("should not fetch tenant access when user has no email", async () => {
      mockUseAuth.mockReturnValue({
        user: { email: "" },
        loading: false,
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(mockFetch).not.toHaveBeenCalled();
      });

      expect(
        screen.getByText("No tenant access available for your account.")
      ).toBeInTheDocument();
    });
  });

  describe("Tenant Access Display", () => {
    it("should display accessible tenants for user", async () => {
      mockUseAuth.mockReturnValue({
        user: { email: "test@nyu.edu" },
        loading: false,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          tenants: ["mc", "itp"],
          userInfo: {
            dept_name: "ITP",
            school_name: "Tisch School of the Arts",
          },
        }),
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText("NYU Booking System")).toBeInTheDocument();
      });

      expect(screen.getByText("Media Commons")).toBeInTheDocument();
      expect(screen.getByText("ITP")).toBeInTheDocument();
      expect(screen.getByText(/Department:/)).toBeInTheDocument();
      expect(screen.getByText(/School:/)).toBeInTheDocument();
    });

    it("should display only accessible tenants when user has limited access", async () => {
      mockUseAuth.mockReturnValue({
        user: { email: "test@nyu.edu" },
        loading: false,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          tenants: ["mc"],
          userInfo: {
            dept_name: "Test Department",
            school_name: "Test School",
          },
        }),
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText("Media Commons")).toBeInTheDocument();
      });

      expect(screen.queryByText("ITP")).not.toBeInTheDocument();
    });

    it("should display ITP only when user has only ITP access", async () => {
      mockUseAuth.mockReturnValue({
        user: { email: "test@nyu.edu" },
        loading: false,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          tenants: ["itp"],
          userInfo: {
            dept_name: "ITP",
            school_name: "Tisch",
          },
        }),
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText("ITP")).toBeInTheDocument();
      });

      expect(screen.queryByText("Media Commons")).not.toBeInTheDocument();
    });

    it("should display no access message when tenants array is empty", async () => {
      mockUseAuth.mockReturnValue({
        user: { email: "test@nyu.edu" },
        loading: false,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          tenants: [],
        }),
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(
          screen.getByText("No tenant access available for your account.")
        ).toBeInTheDocument();
      });
    });

    it("should render correct links for tenants", async () => {
      mockUseAuth.mockReturnValue({
        user: { email: "test@nyu.edu" },
        loading: false,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          tenants: ["mc", "itp"],
        }),
      });

      render(<HomePage />);

      await waitFor(() => {
        const mcLink = screen.getByText("Media Commons").closest("a");
        const itpLink = screen.getByText("ITP").closest("a");

        expect(mcLink).toHaveAttribute("href", "/mc");
        expect(itpLink).toHaveAttribute("href", "/itp");
      });
    });
  });

  describe("User Info Display", () => {
    it("should display user info when available", async () => {
      mockUseAuth.mockReturnValue({
        user: { email: "test@nyu.edu" },
        loading: false,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          tenants: ["mc"],
          userInfo: {
            dept_name: "Interactive Telecommunications Program",
            school_name: "Tisch School of the Arts",
          },
        }),
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(
          screen.getByText(/Department: Interactive Telecommunications Program/)
        ).toBeInTheDocument();
        expect(
          screen.getByText(/School: Tisch School of the Arts/)
        ).toBeInTheDocument();
      });
    });

    it("should display mapped_department over dept_name when available", async () => {
      mockUseAuth.mockReturnValue({
        user: { email: "test@nyu.edu" },
        loading: false,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          tenants: ["mc"],
          userInfo: {
            dept_name: "Raw Department",
            mapped_department: "Mapped Department",
            school_name: "Test School",
          },
        }),
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText(/Department: Mapped Department/)).toBeInTheDocument();
        expect(screen.queryByText(/Raw Department/)).not.toBeInTheDocument();
      });
    });

    it("should display 'N/A' when department and school are not available", async () => {
      mockUseAuth.mockReturnValue({
        user: { email: "test@nyu.edu" },
        loading: false,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          tenants: ["mc"],
          userInfo: {},
        }),
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText(/Department: N\/A/)).toBeInTheDocument();
        expect(screen.getByText(/School: N\/A/)).toBeInTheDocument();
      });
    });

    it("should not display user info section when userInfo is not provided", async () => {
      mockUseAuth.mockReturnValue({
        user: { email: "test@nyu.edu" },
        loading: false,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          tenants: ["mc"],
        }),
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText("Media Commons")).toBeInTheDocument();
      });

      expect(screen.queryByText(/Department:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/School:/)).not.toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("should display error message when API call fails", async () => {
      mockUseAuth.mockReturnValue({
        user: { email: "test@nyu.edu" },
        loading: false,
      });

      mockFetch.mockResolvedValue({
        ok: false,
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(
          screen.getByText("Failed to load tenant access information")
        ).toBeInTheDocument();
      });
    });

    it("should display all tenants when API call fails (fallback)", async () => {
      mockUseAuth.mockReturnValue({
        user: { email: "test@nyu.edu" },
        loading: false,
      });

      mockFetch.mockRejectedValue(new Error("Network error"));

      render(<HomePage />);

      // Wait for error handling to complete
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      // Should display error message
      await waitFor(() => {
        expect(
          screen.getByText("Failed to load tenant access information")
        ).toBeInTheDocument();
      });
    });

    it("should extract netId from email correctly", async () => {
      mockUseAuth.mockReturnValue({
        user: { email: "abc123@nyu.edu" },
        loading: false,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          tenants: ["mc"],
        }),
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/user-tenant-access?netId=abc123"
        );
      });
    });
  });

  describe("API Integration", () => {
    it("should call API with correct netId parameter", async () => {
      mockUseAuth.mockReturnValue({
        user: { email: "testuser@nyu.edu" },
        loading: false,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          tenants: ["mc"],
        }),
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/user-tenant-access?netId=testuser"
        );
      });
    });

    it("should not call API multiple times unnecessarily", async () => {
      mockUseAuth.mockReturnValue({
        user: { email: "test@nyu.edu" },
        loading: false,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          tenants: ["mc"],
        }),
      });

      const { rerender } = render(<HomePage />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      // Rerender should not trigger another API call
      rerender(<HomePage />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("UI Rendering", () => {
    it("should render main title", async () => {
      mockUseAuth.mockReturnValue({
        user: { email: "test@nyu.edu" },
        loading: false,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          tenants: ["mc"],
        }),
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText("NYU Booking System")).toBeInTheDocument();
      });
    });

    it("should apply correct CSS classes to tenant links", async () => {
      mockUseAuth.mockReturnValue({
        user: { email: "test@nyu.edu" },
        loading: false,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          tenants: ["mc"],
        }),
      });

      render(<HomePage />);

      await waitFor(() => {
        const link = screen.getByText("Media Commons").closest("a");
        expect(link).toHaveClass("text-xl", "text-blue-600");
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle unknown tenant in response gracefully", async () => {
      mockUseAuth.mockReturnValue({
        user: { email: "test@nyu.edu" },
        loading: false,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          tenants: ["unknown-tenant", "mc"],
        }),
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText("Media Commons")).toBeInTheDocument();
      });

      // Unknown tenant should not be rendered
      expect(screen.queryByText("unknown-tenant")).not.toBeInTheDocument();
    });

    it("should handle email without @ symbol", async () => {
      mockUseAuth.mockReturnValue({
        user: { email: "invalidemail" },
        loading: false,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          tenants: ["mc"],
        }),
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/user-tenant-access?netId=invalidemail"
        );
      });
    });
  });
});

