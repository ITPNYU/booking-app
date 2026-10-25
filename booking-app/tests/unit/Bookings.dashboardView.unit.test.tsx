import { Bookings } from "@/components/src/client/routes/components/bookingTable/Bookings";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import {
  peekDashboardReturn,
  rememberDashboardReturn,
} from "@/components/src/client/routes/components/bookingTable/dashboardView";
import {
  SchemaContext,
  generateDefaultSchema,
} from "@/components/src/client/routes/components/SchemaProvider";
import {
  BookingStatusLabel,
  PageContextLevel,
  PagePermission,
} from "@/components/src/types";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const searchParams = vi.hoisted(
  () =>
    new URLSearchParams(
      "q=jane&range=Today&status=APPROVED&origin=User&room=202&service=Staffing",
    ),
);
const replace = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, back: vi.fn() }),
  useParams: () => ({ tenant: "mc" }),
  usePathname: () => "/mc/admin",
  useSearchParams: () => searchParams,
}));

vi.mock("@mui/x-data-grid", () => ({
  DataGrid: () => <div data-testid="mock-datagrid" />,
}));

const captured = vi.hoisted(() => ({ current: null as any }));

vi.mock(
  "@/components/src/client/routes/components/bookingTable/hooks/useBookingFilters",
  () => ({
    useBookingFilters: (args: any) => {
      captured.current = args;
      return [];
    },
  }),
);

vi.mock(
  "@/components/src/client/routes/components/bookingTable/hooks/useAllowedStatuses",
  () => ({
    default: () => Object.values(BookingStatusLabel),
  }),
);

function renderBookings() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <DatabaseContext.Provider
        value={
          {
            bookingsLoading: false,
            setLastItem: vi.fn(),
            fetchAllBookings: vi.fn(),
            allBookings: [],
            liaisonUsers: [],
            userEmail: "admin@nyu.edu",
            pagePermission: PagePermission.ADMIN,
            roomSettings: [],
            setFilters: vi.fn(),
          } as any
        }
      >
        <SchemaContext.Provider value={generateDefaultSchema("mc")}>
          <Bookings pageContext={PageContextLevel.ADMIN} />
        </SchemaContext.Provider>
      </DatabaseContext.Provider>
    </ThemeProvider>,
  );
}

describe("Bookings restores the dashboard view from the url", () => {
  it("keeps the search and filters that were on the page", () => {
    renderBookings();

    expect(screen.getByPlaceholderText("Search...")).toHaveValue("jane");
    expect(captured.current).toMatchObject({
      searchQuery: "jane",
      selectedDateRange: "Today",
      selectedStatusFilters: [BookingStatusLabel.APPROVED],
      selectedOrigins: ["User"],
      selectedRooms: ["202"],
      selectedServices: ["Staffing"],
    });
    expect(replace).not.toHaveBeenCalled();
  });

  it("keeps a pending modification's return when a dashboard mounts", () => {
    window.history.pushState({}, "", "/mc/services?q=jane");
    rememberDashboardReturn("modification", "evt1");
    window.history.pushState({}, "", "/mc/admin");

    renderBookings();

    expect(peekDashboardReturn("modification", "mc")).toBe(
      "/mc/services?q=jane",
    );
    sessionStorage.clear();
  });
});
