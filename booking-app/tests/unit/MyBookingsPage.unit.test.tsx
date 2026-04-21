import MyBookingsPage from "@/components/src/client/routes/myBookings/myBookingsPage";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { SchemaContext } from "@/components/src/client/routes/components/SchemaProvider";
import { PageContextLevel, PagePermission } from "@/components/src/types";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

// Capture the pageContext passed to <Bookings> so we can assert on it
const mockBookings = vi.fn();
vi.mock(
  "@/components/src/client/routes/components/bookingTable/Bookings",
  () => ({
    Bookings: (props: { pageContext: PageContextLevel }) => {
      mockBookings(props);
      return (
        <div
          data-testid="bookings"
          data-page-context={props.pageContext}
        />
      );
    },
  })
);

vi.mock("@/components/src/client/routes/components/Loading", () => ({
  CenterLoading: () => <div data-testid="center-loading" />,
}));

const theme = createTheme();

const mockSchemaContext = {
  resourceName: "Room",
  schema: { name: "Media Commons" } as any,
};

function buildDatabaseContext(overrides: Partial<{ userEmail: string | undefined }> = {}) {
  return {
    userEmail: "user@nyu.edu",
    pagePermission: PagePermission.BOOKING,
    adminUsers: [],
    paUsers: [],
    liaisonUsers: [],
    equipmentUsers: [],
    superAdminUsers: [],
    bannedUsers: [],
    allBookings: [],
    bookingsLoading: false,
    settings: { bookingTypes: [] },
    roomSettings: [],
    setFilters: vi.fn(),
    setLoadMoreEnabled: vi.fn(),
    fetchAllBookings: vi.fn(),
    setLastItem: vi.fn(),
    ...overrides,
  } as any;
}

function renderPage(dbCtx: ReturnType<typeof buildDatabaseContext>) {
  return render(
    <ThemeProvider theme={theme}>
      <DatabaseContext.Provider value={dbCtx}>
        <SchemaContext.Provider value={mockSchemaContext as any}>
          <MyBookingsPage />
        </SchemaContext.Provider>
      </DatabaseContext.Provider>
    </ThemeProvider>
  );
}

describe("MyBookingsPage", () => {
  it("shows loading spinner while userEmail is undefined", () => {
    renderPage(buildDatabaseContext({ userEmail: undefined }));
    expect(screen.getByTestId("center-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("bookings")).not.toBeInTheDocument();
  });

  it("renders the Bookings tab once userEmail is resolved", () => {
    renderPage(buildDatabaseContext());
    expect(screen.queryByTestId("center-loading")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Bookings" })).toBeInTheDocument();
    expect(screen.getByTestId("bookings")).toBeInTheDocument();
  });

  it("passes PageContextLevel.USER to <Bookings> — never a privileged level", () => {
    renderPage(buildDatabaseContext());
    expect(mockBookings).toHaveBeenCalledWith(
      expect.objectContaining({ pageContext: PageContextLevel.USER })
    );
    // Explicitly assert none of the privileged levels are passed
    const calledWith: PageContextLevel = mockBookings.mock.calls[0][0].pageContext;
    expect(calledWith).not.toBe(PageContextLevel.PA);
    expect(calledWith).not.toBe(PageContextLevel.LIAISON);
    expect(calledWith).not.toBe(PageContextLevel.ADMIN);
  });

  it("exposes only a single Bookings tab — no Settings or admin-only tabs", () => {
    renderPage(buildDatabaseContext());
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toHaveTextContent("Bookings");
  });

  it("Bookings panel is visible by default without any tab interaction", () => {
    renderPage(buildDatabaseContext());
    expect(screen.getByTestId("bookings")).toBeInTheDocument();
  });

  it("does not expose settings or admin controls even if the user has a higher permission stored", () => {
    // A user whose permission was resolved to ADMIN should still see only
    // the USER-level bookings view on the my-bookings page.
    renderPage(buildDatabaseContext({ userEmail: "admin@nyu.edu" }));
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(1);
    expect(screen.queryByRole("tab", { name: /settings/i })).not.toBeInTheDocument();
    expect(mockBookings).toHaveBeenCalledWith(
      expect.objectContaining({ pageContext: PageContextLevel.USER })
    );
  });
});
