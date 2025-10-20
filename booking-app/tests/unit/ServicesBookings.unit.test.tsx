import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ServicesBookings from "../../components/src/client/routes/services/ServicesBookings";
import { DatabaseContext } from "../../components/src/client/routes/components/Provider";
import { PageContextLevel } from "../../components/src/types";

// Mock the Bookings component
vi.mock(
  "../../components/src/client/routes/components/bookingTable/Bookings",
  () => ({
    Bookings: ({ pageContext }: { pageContext: PageContextLevel }) => (
      <div data-testid="bookings-component" data-page-context={pageContext}>
        Bookings Component
      </div>
    ),
  })
);

// Mock XStateUtils
vi.mock("../../components/src/utils/xstateUnified", () => ({
  XStateUtils: {
    getServicesRequestBookings: vi.fn(),
    debugXState: vi.fn(),
  },
}));

import { XStateUtils } from "../../components/src/utils/xstateUnified";

const mockGetServicesRequestBookings = vi.mocked(
  XStateUtils.getServicesRequestBookings
);
const mockDebugXState = vi.mocked(XStateUtils.debugXState);

describe("ServicesBookings Component", () => {
  const mockContextValue = {
    userEmail: "test@nyu.edu",
    netId: "test123",
    pagePermission: "SERVICES",
    bookingsLoading: false,
    allBookings: [],
    reloadFutureBookings: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServicesRequestBookings.mockReturnValue([]);
  });

  describe("Rendering", () => {
    it("renders Bookings component", () => {
      render(
        <DatabaseContext.Provider value={mockContextValue as any}>
          <ServicesBookings />
        </DatabaseContext.Provider>
      );

      expect(screen.getByTestId("bookings-component")).toBeInTheDocument();
    });

    it("passes SERVICES page context to Bookings component", () => {
      render(
        <DatabaseContext.Provider value={mockContextValue as any}>
          <ServicesBookings />
        </DatabaseContext.Provider>
      );

      const bookingsComponent = screen.getByTestId("bookings-component");
      expect(bookingsComponent).toHaveAttribute(
        "data-page-context",
        String(PageContextLevel.SERVICES)
      );
    });
  });

  describe("Filtering Service Request Bookings", () => {
    it("filters bookings to show only service requests using XStateUtils", () => {
      const allBookings = [
        {
          id: "booking-1",
          calendarEventId: "event-1",
          xstateData: { value: { "Services Request": {} } },
        },
        {
          id: "booking-2",
          calendarEventId: "event-2",
          xstateData: { value: "Approved" },
        },
        {
          id: "booking-3",
          calendarEventId: "event-3",
          xstateData: { value: { "Services Request": {} } },
        },
      ];

      const filteredBookings = [allBookings[0], allBookings[2]];
      mockGetServicesRequestBookings.mockReturnValue(filteredBookings);

      const contextWithBookings = {
        ...mockContextValue,
        allBookings,
      };

      render(
        <DatabaseContext.Provider value={contextWithBookings as any}>
          <ServicesBookings />
        </DatabaseContext.Provider>
      );

      expect(mockGetServicesRequestBookings).toHaveBeenCalledWith(allBookings);
      expect(mockGetServicesRequestBookings).toHaveBeenCalledTimes(1);
    });

    it("handles empty bookings array", () => {
      mockGetServicesRequestBookings.mockReturnValue([]);

      const contextWithEmptyBookings = {
        ...mockContextValue,
        allBookings: [],
      };

      render(
        <DatabaseContext.Provider value={contextWithEmptyBookings as any}>
          <ServicesBookings />
        </DatabaseContext.Provider>
      );

      // When allBookings is empty, the function is not called (early return)
      expect(mockGetServicesRequestBookings).not.toHaveBeenCalled();
      expect(screen.getByTestId("bookings-component")).toBeInTheDocument();
    });

    it("handles null bookings", () => {
      mockGetServicesRequestBookings.mockReturnValue([]);

      const contextWithNullBookings = {
        ...mockContextValue,
        allBookings: null,
      };

      render(
        <DatabaseContext.Provider value={contextWithNullBookings as any}>
          <ServicesBookings />
        </DatabaseContext.Provider>
      );

      expect(mockGetServicesRequestBookings).not.toHaveBeenCalled();
      expect(screen.getByTestId("bookings-component")).toBeInTheDocument();
    });

    it("handles undefined bookings", () => {
      mockGetServicesRequestBookings.mockReturnValue([]);

      const contextWithUndefinedBookings = {
        ...mockContextValue,
        allBookings: undefined,
      };

      render(
        <DatabaseContext.Provider value={contextWithUndefinedBookings as any}>
          <ServicesBookings />
        </DatabaseContext.Provider>
      );

      expect(mockGetServicesRequestBookings).not.toHaveBeenCalled();
      expect(screen.getByTestId("bookings-component")).toBeInTheDocument();
    });

    it("returns empty array when no service request bookings found", () => {
      const allBookings = [
        {
          id: "booking-1",
          calendarEventId: "event-1",
          xstateData: { value: "Approved" },
        },
        {
          id: "booking-2",
          calendarEventId: "event-2",
          xstateData: { value: "Checked In" },
        },
      ];

      mockGetServicesRequestBookings.mockReturnValue([]);

      const contextWithBookings = {
        ...mockContextValue,
        allBookings,
      };

      render(
        <DatabaseContext.Provider value={contextWithBookings as any}>
          <ServicesBookings />
        </DatabaseContext.Provider>
      );

      expect(mockGetServicesRequestBookings).toHaveBeenCalledWith(allBookings);
      expect(screen.getByTestId("bookings-component")).toBeInTheDocument();
    });
  });

  describe("Debug Logging", () => {
    it("calls debugXState for each filtered booking", () => {
      const filteredBookings = [
        {
          id: "booking-1",
          calendarEventId: "event-1",
          xstateData: { value: { "Services Request": {} } },
        },
        {
          id: "booking-2",
          calendarEventId: "event-2",
          xstateData: { value: { "Services Request": {} } },
        },
      ];

      mockGetServicesRequestBookings.mockReturnValue(filteredBookings);

      const contextWithBookings = {
        ...mockContextValue,
        allBookings: filteredBookings,
      };

      render(
        <DatabaseContext.Provider value={contextWithBookings as any}>
          <ServicesBookings />
        </DatabaseContext.Provider>
      );

      expect(mockDebugXState).toHaveBeenCalledTimes(2);
      expect(mockDebugXState).toHaveBeenCalledWith(
        filteredBookings[0],
        "SERVICES FILTER DEBUG"
      );
      expect(mockDebugXState).toHaveBeenCalledWith(
        filteredBookings[1],
        "SERVICES FILTER DEBUG"
      );
    });

    it("does not call debugXState when no bookings are filtered", () => {
      mockGetServicesRequestBookings.mockReturnValue([]);

      render(
        <DatabaseContext.Provider value={mockContextValue as any}>
          <ServicesBookings />
        </DatabaseContext.Provider>
      );

      expect(mockDebugXState).not.toHaveBeenCalled();
    });
  });

  describe("Context Customization", () => {
    it("provides custom context with filtered bookings to child Bookings component", () => {
      const allBookings = [
        {
          id: "booking-1",
          calendarEventId: "event-1",
          xstateData: { value: { "Services Request": {} } },
        },
        {
          id: "booking-2",
          calendarEventId: "event-2",
          xstateData: { value: "Approved" },
        },
        {
          id: "booking-3",
          calendarEventId: "event-3",
          xstateData: { value: { "Services Request": {} } },
        },
      ];

      const filteredBookings = [allBookings[0], allBookings[2]];
      mockGetServicesRequestBookings.mockReturnValue(filteredBookings);

      const contextWithBookings = {
        ...mockContextValue,
        allBookings,
      };

      render(
        <DatabaseContext.Provider value={contextWithBookings as any}>
          <ServicesBookings />
        </DatabaseContext.Provider>
      );

      // The component should render and provide filtered context
      expect(screen.getByTestId("bookings-component")).toBeInTheDocument();
      expect(mockGetServicesRequestBookings).toHaveBeenCalledWith(allBookings);
    });

    it("preserves other context properties", () => {
      const customContext = {
        ...mockContextValue,
        userEmail: "custom@nyu.edu",
        netId: "custom123",
        pagePermission: "ADMIN",
        bookingsLoading: true,
        reloadFutureBookings: vi.fn(),
        allBookings: [],
      };

      mockGetServicesRequestBookings.mockReturnValue([]);

      render(
        <DatabaseContext.Provider value={customContext as any}>
          <ServicesBookings />
        </DatabaseContext.Provider>
      );

      // Component should render without errors
      expect(screen.getByTestId("bookings-component")).toBeInTheDocument();
    });
  });

  describe("Memoization", () => {
    it("recalculates filtered bookings when allBookings changes", () => {
      const initialBookings = [
        {
          id: "booking-1",
          calendarEventId: "event-1",
          xstateData: { value: { "Services Request": {} } },
        },
      ];

      const updatedBookings = [
        {
          id: "booking-1",
          calendarEventId: "event-1",
          xstateData: { value: { "Services Request": {} } },
        },
        {
          id: "booking-2",
          calendarEventId: "event-2",
          xstateData: { value: { "Services Request": {} } },
        },
      ];

      mockGetServicesRequestBookings.mockReturnValue(initialBookings);

      const { rerender } = render(
        <DatabaseContext.Provider
          value={{ ...mockContextValue, allBookings: initialBookings } as any}
        >
          <ServicesBookings />
        </DatabaseContext.Provider>
      );

      expect(mockGetServicesRequestBookings).toHaveBeenCalledWith(
        initialBookings
      );

      mockGetServicesRequestBookings.mockReturnValue(updatedBookings);

      rerender(
        <DatabaseContext.Provider
          value={{ ...mockContextValue, allBookings: updatedBookings } as any}
        >
          <ServicesBookings />
        </DatabaseContext.Provider>
      );

      expect(mockGetServicesRequestBookings).toHaveBeenCalledWith(
        updatedBookings
      );
    });

    it("does not recalculate when allBookings reference stays the same", () => {
      const bookings = [
        {
          id: "booking-1",
          calendarEventId: "event-1",
          xstateData: { value: { "Services Request": {} } },
        },
      ];

      mockGetServicesRequestBookings.mockReturnValue(bookings);

      const { rerender } = render(
        <DatabaseContext.Provider
          value={{ ...mockContextValue, allBookings: bookings } as any}
        >
          <ServicesBookings />
        </DatabaseContext.Provider>
      );

      const firstCallCount = mockGetServicesRequestBookings.mock.calls.length;

      rerender(
        <DatabaseContext.Provider
          value={{ ...mockContextValue, allBookings: bookings } as any}
        >
          <ServicesBookings />
        </DatabaseContext.Provider>
      );

      // Should not call again if reference is the same (memoization)
      expect(mockGetServicesRequestBookings).toHaveBeenCalledTimes(
        firstCallCount
      );
    });
  });

  describe("Console Logging", () => {
    it("logs the count of service request bookings", () => {
      const consoleSpy = vi.spyOn(console, "log");

      const filteredBookings = [
        {
          id: "booking-1",
          calendarEventId: "event-1",
          xstateData: { value: { "Services Request": {} } },
        },
        {
          id: "booking-2",
          calendarEventId: "event-2",
          xstateData: { value: { "Services Request": {} } },
        },
      ];

      mockGetServicesRequestBookings.mockReturnValue(filteredBookings);

      const contextWithBookings = {
        ...mockContextValue,
        allBookings: filteredBookings,
      };

      render(
        <DatabaseContext.Provider value={contextWithBookings as any}>
          <ServicesBookings />
        </DatabaseContext.Provider>
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '📋 SERVICES BOOKINGS: Found 2 bookings with "Service Requested" state'
        )
      );

      consoleSpy.mockRestore();
    });

    it("logs zero when no service request bookings found", () => {
      const consoleSpy = vi.spyOn(console, "log");

      mockGetServicesRequestBookings.mockReturnValue([]);

      render(
        <DatabaseContext.Provider value={mockContextValue as any}>
          <ServicesBookings />
        </DatabaseContext.Provider>
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '📋 SERVICES BOOKINGS: Found 0 bookings with "Service Requested" state'
        )
      );

      consoleSpy.mockRestore();
    });
  });
});
