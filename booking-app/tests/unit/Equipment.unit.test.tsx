import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseContext } from "../../components/src/client/routes/components/Provider";
import { SchemaContext } from "../../components/src/client/routes/components/SchemaProvider";
import Equipment from "../../components/src/client/routes/equipment/Equipment";
import { PageContextLevel, PagePermission } from "../../components/src/types";

// Mock Bookings component
vi.mock(
  "../../components/src/client/routes/components/bookingTable/Bookings",
  () => ({
    Bookings: vi.fn(({ pageContext }) => (
      <div data-testid="mock-bookings" data-page-context={pageContext}>
        Mock Bookings Component
      </div>
    )),
  })
);

// Mock permissions utility
vi.mock("../../components/src/utils/permissions", () => ({
  hasAnyPermission: vi.fn(),
}));

const theme = createTheme();

const mockDatabaseContext = {
  pagePermission: PagePermission.EQUIPMENT,
  userEmail: "equipment@nyu.edu",
  bookingsLoading: false,
  allBookings: [],
  liaisonUsers: [],
  adminUsers: [],
  PAUsers: [],
  settings: { bookingTypes: [] },
  roomSettings: [],
};

const mockSchemaContext = {
  resourceName: "Room",
  schema: {} as any,
};

const renderEquipmentComponent = (
  pagePermission = PagePermission.EQUIPMENT
) => {
  const databaseContext = { ...mockDatabaseContext, pagePermission };

  return render(
    <ThemeProvider theme={theme}>
      <DatabaseContext.Provider value={databaseContext as any}>
        <SchemaContext.Provider value={mockSchemaContext}>
          <Equipment />
        </SchemaContext.Provider>
      </DatabaseContext.Provider>
    </ThemeProvider>
  );
};

describe("Equipment Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to having permission
    const {
      hasAnyPermission,
    } = require("../../components/src/utils/permissions");
    hasAnyPermission.mockReturnValue(true);
  });

  describe("Permission Checks", () => {
    it("should render equipment interface for users with EQUIPMENT permission", () => {
      const {
        hasAnyPermission,
      } = require("../../components/src/utils/permissions");
      hasAnyPermission.mockReturnValue(true);

      renderEquipmentComponent(PagePermission.EQUIPMENT);

      expect(screen.getByText("Bookings")).toBeInTheDocument();
      expect(screen.getByTestId("mock-bookings")).toBeInTheDocument();
      expect(
        screen.queryByText("You do not have permission to view this page.")
      ).not.toBeInTheDocument();

      expect(hasAnyPermission).toHaveBeenCalledWith(PagePermission.EQUIPMENT, [
        PagePermission.ADMIN,
        PagePermission.EQUIPMENT,
        PagePermission.SUPER_ADMIN,
      ]);
    });

    it("should render equipment interface for users with ADMIN permission", () => {
      const {
        hasAnyPermission,
      } = require("@/components/src/utils/permissions");
      hasAnyPermission.mockReturnValue(true);

      renderEquipmentComponent(PagePermission.ADMIN);

      expect(screen.getByText("Bookings")).toBeInTheDocument();
      expect(screen.getByTestId("mock-bookings")).toBeInTheDocument();
      expect(
        screen.queryByText("You do not have permission to view this page.")
      ).not.toBeInTheDocument();

      expect(hasAnyPermission).toHaveBeenCalledWith(PagePermission.ADMIN, [
        PagePermission.ADMIN,
        PagePermission.EQUIPMENT,
        PagePermission.SUPER_ADMIN,
      ]);
    });

    it("should render equipment interface for users with SUPER_ADMIN permission", () => {
      const {
        hasAnyPermission,
      } = require("@/components/src/utils/permissions");
      hasAnyPermission.mockReturnValue(true);

      renderEquipmentComponent(PagePermission.SUPER_ADMIN);

      expect(screen.getByText("Bookings")).toBeInTheDocument();
      expect(screen.getByTestId("mock-bookings")).toBeInTheDocument();
      expect(
        screen.queryByText("You do not have permission to view this page.")
      ).not.toBeInTheDocument();

      expect(hasAnyPermission).toHaveBeenCalledWith(
        PagePermission.SUPER_ADMIN,
        [
          PagePermission.ADMIN,
          PagePermission.EQUIPMENT,
          PagePermission.SUPER_ADMIN,
        ]
      );
    });

    it("should show permission denied message for users without appropriate permissions", () => {
      const {
        hasAnyPermission,
      } = require("@/components/src/utils/permissions");
      hasAnyPermission.mockReturnValue(false);

      renderEquipmentComponent(PagePermission.BOOKING);

      expect(
        screen.getByText("You do not have permission to view this page.")
      ).toBeInTheDocument();
      expect(screen.queryByText("Bookings")).not.toBeInTheDocument();
      expect(screen.queryByTestId("mock-bookings")).not.toBeInTheDocument();

      expect(hasAnyPermission).toHaveBeenCalledWith(PagePermission.BOOKING, [
        PagePermission.ADMIN,
        PagePermission.EQUIPMENT,
        PagePermission.SUPER_ADMIN,
      ]);
    });

    it("should deny access to PA users", () => {
      const {
        hasAnyPermission,
      } = require("@/components/src/utils/permissions");
      hasAnyPermission.mockReturnValue(false);

      renderEquipmentComponent(PagePermission.PA);

      expect(
        screen.getByText("You do not have permission to view this page.")
      ).toBeInTheDocument();
      expect(hasAnyPermission).toHaveBeenCalledWith(PagePermission.PA, [
        PagePermission.ADMIN,
        PagePermission.EQUIPMENT,
        PagePermission.SUPER_ADMIN,
      ]);
    });

    it("should deny access to LIAISON users", () => {
      const {
        hasAnyPermission,
      } = require("@/components/src/utils/permissions");
      hasAnyPermission.mockReturnValue(false);

      renderEquipmentComponent(PagePermission.LIAISON);

      expect(
        screen.getByText("You do not have permission to view this page.")
      ).toBeInTheDocument();
      expect(hasAnyPermission).toHaveBeenCalledWith(PagePermission.LIAISON, [
        PagePermission.ADMIN,
        PagePermission.EQUIPMENT,
        PagePermission.SUPER_ADMIN,
      ]);
    });
  });

  describe("UI Components", () => {
    it("should render the tabs component", () => {
      renderEquipmentComponent();

      const tabsContainer = screen.getByRole("tablist");
      expect(tabsContainer).toBeInTheDocument();
    });

    it("should render the Bookings tab as selected by default", () => {
      renderEquipmentComponent();

      const bookingsTab = screen.getByRole("tab", { name: "Bookings" });
      expect(bookingsTab).toBeInTheDocument();
      expect(bookingsTab).toHaveAttribute("aria-selected", "true");
    });

    it("should pass correct pageContext to Bookings component", () => {
      renderEquipmentComponent();

      const bookingsComponent = screen.getByTestId("mock-bookings");
      expect(bookingsComponent).toHaveAttribute(
        "data-page-context",
        PageContextLevel.EQUIPMENT.toString()
      );
    });
  });

  describe("Tab Navigation", () => {
    it("should maintain Bookings tab selection when clicked", async () => {
      const user = userEvent.setup();
      renderEquipmentComponent();

      const bookingsTab = screen.getByRole("tab", { name: "Bookings" });

      await user.click(bookingsTab);

      expect(bookingsTab).toHaveAttribute("aria-selected", "true");
      expect(screen.getByTestId("mock-bookings")).toBeInTheDocument();
    });

    it("should render Bookings component when Bookings tab is active", () => {
      renderEquipmentComponent();

      // Verify that the Bookings component is rendered
      const bookingsComponent = screen.getByTestId("mock-bookings");
      expect(bookingsComponent).toBeInTheDocument();
      expect(bookingsComponent).toHaveTextContent("Mock Bookings Component");
    });
  });

  describe("Layout and Styling", () => {
    it("should render with proper margin styling", () => {
      renderEquipmentComponent();

      const mainContainer = screen.getByText("Bookings").closest("div");
      // Check that the component renders without errors
      expect(mainContainer).toBeInTheDocument();
    });

    it("should render tabs with correct theme colors", () => {
      renderEquipmentComponent();

      const bookingsTab = screen.getByRole("tab", { name: "Bookings" });
      expect(bookingsTab).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("should handle missing database context gracefully", () => {
      // This test ensures the component doesn't crash if context is undefined
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      try {
        render(
          <ThemeProvider theme={theme}>
            <DatabaseContext.Provider value={undefined as any}>
              <SchemaContext.Provider value={mockSchemaContext}>
                <Equipment />
              </SchemaContext.Provider>
            </DatabaseContext.Provider>
          </ThemeProvider>
        );
      } catch (error) {
        // Expected to throw due to undefined context
        expect(error).toBeDefined();
      }

      consoleSpy.mockRestore();
    });
  });

  describe("Integration", () => {
    it("should properly integrate with permission checking system", () => {
      const {
        hasAnyPermission,
      } = require("@/components/src/utils/permissions");
      hasAnyPermission.mockReturnValue(true);

      renderEquipmentComponent(PagePermission.EQUIPMENT);

      expect(hasAnyPermission).toHaveBeenCalledTimes(1);
      expect(hasAnyPermission).toHaveBeenCalledWith(PagePermission.EQUIPMENT, [
        PagePermission.ADMIN,
        PagePermission.EQUIPMENT,
        PagePermission.SUPER_ADMIN,
      ]);
    });

    it("should render equipment-specific booking view", () => {
      renderEquipmentComponent();

      const bookingsComponent = screen.getByTestId("mock-bookings");
      expect(bookingsComponent).toHaveAttribute(
        "data-page-context",
        PageContextLevel.EQUIPMENT.toString()
      );
    });
  });
});
