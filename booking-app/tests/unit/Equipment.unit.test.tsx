import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseContext } from "../../components/src/client/routes/components/Provider";
import { SchemaContext } from "../../components/src/client/routes/components/SchemaProvider";
import Equipment from "../../components/src/client/routes/equipment/Equipment";
import { PageContextLevel, PagePermission } from "../../components/src/types";
import { hasAnyPermission } from "../../components/src/utils/permissions";

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

// Mock permissions utility with a simple mock function
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
  const mockHasAnyPermission = vi.mocked(hasAnyPermission);

  beforeEach(() => {
    vi.clearAllMocks();

    // Default to having permission
    mockHasAnyPermission.mockReturnValue(true);
  });

  describe("Permission Checks", () => {
    it("should render equipment interface for users with EQUIPMENT permission", () => {
      mockHasAnyPermission.mockReturnValue(true);

      renderEquipmentComponent(PagePermission.EQUIPMENT);

      expect(screen.getByText("Bookings")).toBeInTheDocument();
      expect(screen.getByTestId("mock-bookings")).toBeInTheDocument();
      expect(
        screen.queryByText("You do not have permission to view this page.")
      ).not.toBeInTheDocument();

      expect(mockHasAnyPermission).toHaveBeenCalledWith(
        PagePermission.EQUIPMENT,
        [
          PagePermission.ADMIN,
          PagePermission.EQUIPMENT,
          PagePermission.SUPER_ADMIN,
        ]
      );
    });

    it("should render equipment interface for users with ADMIN permission", () => {
      mockHasAnyPermission.mockReturnValue(true);

      renderEquipmentComponent(PagePermission.ADMIN);

      expect(screen.getByText("Bookings")).toBeInTheDocument();
      expect(screen.getByTestId("mock-bookings")).toBeInTheDocument();
      expect(
        screen.queryByText("You do not have permission to view this page.")
      ).not.toBeInTheDocument();

      expect(mockHasAnyPermission).toHaveBeenCalledWith(PagePermission.ADMIN, [
        PagePermission.ADMIN,
        PagePermission.EQUIPMENT,
        PagePermission.SUPER_ADMIN,
      ]);
    });

    it("should render equipment interface for users with SUPER_ADMIN permission", () => {
      mockHasAnyPermission.mockReturnValue(true);

      renderEquipmentComponent(PagePermission.SUPER_ADMIN);

      expect(screen.getByText("Bookings")).toBeInTheDocument();
      expect(screen.getByTestId("mock-bookings")).toBeInTheDocument();
      expect(
        screen.queryByText("You do not have permission to view this page.")
      ).not.toBeInTheDocument();

      expect(mockHasAnyPermission).toHaveBeenCalledWith(
        PagePermission.SUPER_ADMIN,
        [
          PagePermission.ADMIN,
          PagePermission.EQUIPMENT,
          PagePermission.SUPER_ADMIN,
        ]
      );
    });

    it("should show permission denied message for users without appropriate permissions", () => {
      mockHasAnyPermission.mockReturnValue(false);

      renderEquipmentComponent(PagePermission.BOOKING);

      expect(
        screen.getByText("You do not have permission to view this page.")
      ).toBeInTheDocument();
      expect(screen.queryByText("Bookings")).not.toBeInTheDocument();
      expect(screen.queryByTestId("mock-bookings")).not.toBeInTheDocument();

      expect(mockHasAnyPermission).toHaveBeenCalledWith(
        PagePermission.BOOKING,
        [
          PagePermission.ADMIN,
          PagePermission.EQUIPMENT,
          PagePermission.SUPER_ADMIN,
        ]
      );
    });

    it("should deny access to PA users", () => {
      mockHasAnyPermission.mockReturnValue(false);

      renderEquipmentComponent(PagePermission.PA);

      expect(
        screen.getByText("You do not have permission to view this page.")
      ).toBeInTheDocument();
      expect(mockHasAnyPermission).toHaveBeenCalledWith(PagePermission.PA, [
        PagePermission.ADMIN,
        PagePermission.EQUIPMENT,
        PagePermission.SUPER_ADMIN,
      ]);
    });

    it("should deny access to LIAISON users", () => {
      mockHasAnyPermission.mockReturnValue(false);

      renderEquipmentComponent(PagePermission.LIAISON);

      expect(
        screen.getByText("You do not have permission to view this page.")
      ).toBeInTheDocument();
      expect(mockHasAnyPermission).toHaveBeenCalledWith(
        PagePermission.LIAISON,
        [
          PagePermission.ADMIN,
          PagePermission.EQUIPMENT,
          PagePermission.SUPER_ADMIN,
        ]
      );
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

    it("should pass EQUIPMENT page context to Bookings component", () => {
      renderEquipmentComponent();

      const bookingsComponent = screen.getByTestId("mock-bookings");
      expect(bookingsComponent).toHaveAttribute(
        "data-page-context",
        PageContextLevel.EQUIPMENT.toString()
      );
    });

    it("should handle tab interaction", async () => {
      const user = userEvent.setup();
      renderEquipmentComponent();

      const bookingsTab = screen.getByRole("tab", { name: "Bookings" });
      await user.click(bookingsTab);

      expect(bookingsTab).toHaveAttribute("aria-selected", "true");
    });
  });

  describe("Equipment-specific behavior", () => {
    it("should show equipment-appropriate UI elements", () => {
      renderEquipmentComponent();

      // Should show the main equipment interface
      expect(screen.getByText("Bookings")).toBeInTheDocument();
      expect(screen.getByTestId("mock-bookings")).toBeInTheDocument();
    });

    it("should maintain equipment context throughout component lifecycle", () => {
      const { rerender } = renderEquipmentComponent(PagePermission.EQUIPMENT);

      // Initial render
      expect(screen.getByTestId("mock-bookings")).toHaveAttribute(
        "data-page-context",
        PageContextLevel.EQUIPMENT.toString()
      );

      // Re-render with same permission
      rerender(
        <ThemeProvider theme={theme}>
          <DatabaseContext.Provider
            value={
              {
                ...mockDatabaseContext,
                pagePermission: PagePermission.EQUIPMENT,
              } as any
            }
          >
            <SchemaContext.Provider value={mockSchemaContext}>
              <Equipment />
            </SchemaContext.Provider>
          </DatabaseContext.Provider>
        </ThemeProvider>
      );

      // Context should remain consistent
      expect(screen.getByTestId("mock-bookings")).toHaveAttribute(
        "data-page-context",
        PageContextLevel.EQUIPMENT.toString()
      );
    });
  });

  describe("Error handling", () => {
    it("should handle undefined permissions gracefully", () => {
      mockHasAnyPermission.mockReturnValue(false);

      renderEquipmentComponent(undefined as any);

      // Should show permission denied for undefined permission
      expect(
        screen.getByText("You do not have permission to view this page.")
      ).toBeInTheDocument();
    });

    it("should handle permission check function errors", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockHasAnyPermission.mockImplementation(() => {
        throw new Error("Permission check failed");
      });

      // Component will throw but should be handled at a higher level
      try {
        renderEquipmentComponent();
        // If we get here, the component didn't throw (unexpected)
        expect(
          screen.getByText("You do not have permission to view this page.")
        ).toBeInTheDocument();
      } catch (error) {
        // Expected behavior - the component throws when permission check fails
        expect(error.message).toBe("Permission check failed");
      }

      consoleSpy.mockRestore();
    });
  });
});
