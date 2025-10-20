import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Services from "../../components/src/client/routes/services/Services";
import { DatabaseContext } from "../../components/src/client/routes/components/Provider";
import { PagePermission } from "../../components/src/types";

// Mock the ServicesBookings component
vi.mock(
  "../../components/src/client/routes/services/ServicesBookings",
  () => ({
    default: () => <div data-testid="services-bookings">Services Bookings</div>,
  })
);

describe("Services Component", () => {
  const mockContextValue = {
    pagePermission: PagePermission.SERVICES,
    userEmail: "test@nyu.edu",
    netId: "test123",
    bookingsLoading: false,
    allBookings: [],
    reloadFutureBookings: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Permission-based Rendering", () => {
    it("renders without permission message when user lacks permissions", () => {
      const contextWithNoPermission = {
        ...mockContextValue,
        pagePermission: PagePermission.USER,
      };

      render(
        <DatabaseContext.Provider value={contextWithNoPermission as any}>
          <Services />
        </DatabaseContext.Provider>
      );

      expect(
        screen.getByText("You do not have permission to view this page.")
      ).toBeInTheDocument();
      expect(screen.queryByTestId("services-bookings")).not.toBeInTheDocument();
    });

    it("renders services content when user has SERVICES permission", () => {
      render(
        <DatabaseContext.Provider value={mockContextValue as any}>
          <Services />
        </DatabaseContext.Provider>
      );

      expect(
        screen.queryByText("You do not have permission to view this page.")
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("services-bookings")).toBeInTheDocument();
    });

    it("renders services content when user has ADMIN permission", () => {
      const contextWithAdminPermission = {
        ...mockContextValue,
        pagePermission: PagePermission.ADMIN,
      };

      render(
        <DatabaseContext.Provider value={contextWithAdminPermission as any}>
          <Services />
        </DatabaseContext.Provider>
      );

      expect(
        screen.queryByText("You do not have permission to view this page.")
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("services-bookings")).toBeInTheDocument();
    });

    it("renders services content when user has SUPER_ADMIN permission", () => {
      const contextWithSuperAdminPermission = {
        ...mockContextValue,
        pagePermission: PagePermission.SUPER_ADMIN,
      };

      render(
        <DatabaseContext.Provider
          value={contextWithSuperAdminPermission as any}
        >
          <Services />
        </DatabaseContext.Provider>
      );

      expect(
        screen.queryByText("You do not have permission to view this page.")
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("services-bookings")).toBeInTheDocument();
    });

    it("does not render services content when user has PA permission", () => {
      const contextWithPAPermission = {
        ...mockContextValue,
        pagePermission: PagePermission.PA,
      };

      render(
        <DatabaseContext.Provider value={contextWithPAPermission as any}>
          <Services />
        </DatabaseContext.Provider>
      );

      expect(
        screen.getByText("You do not have permission to view this page.")
      ).toBeInTheDocument();
      expect(screen.queryByTestId("services-bookings")).not.toBeInTheDocument();
    });

    it("does not render services content when user has LIAISON permission", () => {
      const contextWithLiaisonPermission = {
        ...mockContextValue,
        pagePermission: PagePermission.LIAISON,
      };

      render(
        <DatabaseContext.Provider value={contextWithLiaisonPermission as any}>
          <Services />
        </DatabaseContext.Provider>
      );

      expect(
        screen.getByText("You do not have permission to view this page.")
      ).toBeInTheDocument();
      expect(screen.queryByTestId("services-bookings")).not.toBeInTheDocument();
    });
  });

  describe("Tabs", () => {
    it("renders Service Requests tab", () => {
      render(
        <DatabaseContext.Provider value={mockContextValue as any}>
          <Services />
        </DatabaseContext.Provider>
      );

      expect(screen.getByRole("tab", { name: /service requests/i })).toBeInTheDocument();
    });

    it("has Service Requests tab selected by default", () => {
      render(
        <DatabaseContext.Provider value={mockContextValue as any}>
          <Services />
        </DatabaseContext.Provider>
      );

      const serviceRequestsTab = screen.getByRole("tab", {
        name: /service requests/i,
      });
      expect(serviceRequestsTab).toHaveAttribute("aria-selected", "true");
    });

    it("displays ServicesBookings component when Service Requests tab is active", () => {
      render(
        <DatabaseContext.Provider value={mockContextValue as any}>
          <Services />
        </DatabaseContext.Provider>
      );

      expect(screen.getByTestId("services-bookings")).toBeInTheDocument();
    });

    it("clicking on Service Requests tab keeps ServicesBookings visible", async () => {
      const user = userEvent.setup();

      render(
        <DatabaseContext.Provider value={mockContextValue as any}>
          <Services />
        </DatabaseContext.Provider>
      );

      const serviceRequestsTab = screen.getByRole("tab", {
        name: /service requests/i,
      });

      await user.click(serviceRequestsTab);

      await waitFor(() => {
        expect(screen.getByTestId("services-bookings")).toBeInTheDocument();
      });
    });
  });

  describe("Component Structure", () => {
    it("renders within a Box with margin", () => {
      const { container } = render(
        <DatabaseContext.Provider value={mockContextValue as any}>
          <Services />
        </DatabaseContext.Provider>
      );

      const box = container.querySelector(".MuiBox-root");
      expect(box).toBeInTheDocument();
    });

    it("renders tabs with correct styling", () => {
      render(
        <DatabaseContext.Provider value={mockContextValue as any}>
          <Services />
        </DatabaseContext.Provider>
      );

      const tabsContainer = screen.getByRole("tablist");
      expect(tabsContainer).toBeInTheDocument();
    });
  });

  describe("Context Integration", () => {
    it("uses pagePermission from DatabaseContext", () => {
      const contextWithDifferentPermission = {
        ...mockContextValue,
        pagePermission: PagePermission.USER,
      };

      render(
        <DatabaseContext.Provider
          value={contextWithDifferentPermission as any}
        >
          <Services />
        </DatabaseContext.Provider>
      );

      expect(
        screen.getByText("You do not have permission to view this page.")
      ).toBeInTheDocument();
    });

    it("handles undefined pagePermission gracefully", () => {
      const contextWithUndefinedPermission = {
        ...mockContextValue,
        pagePermission: undefined,
      };

      render(
        <DatabaseContext.Provider
          value={contextWithUndefinedPermission as any}
        >
          <Services />
        </DatabaseContext.Provider>
      );

      expect(
        screen.getByText("You do not have permission to view this page.")
      ).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("renders accessible tab structure", () => {
      render(
        <DatabaseContext.Provider value={mockContextValue as any}>
          <Services />
        </DatabaseContext.Provider>
      );

      const tablist = screen.getByRole("tablist");
      expect(tablist).toBeInTheDocument();

      const tab = screen.getByRole("tab", { name: /service requests/i });
      expect(tab).toHaveAttribute("aria-selected");
    });

    it("provides meaningful error message for unauthorized users", () => {
      const contextWithNoPermission = {
        ...mockContextValue,
        pagePermission: PagePermission.USER,
      };

      render(
        <DatabaseContext.Provider value={contextWithNoPermission as any}>
          <Services />
        </DatabaseContext.Provider>
      );

      const message = screen.getByText(
        "You do not have permission to view this page."
      );
      expect(message).toBeVisible();
    });
  });
});
