import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { useBookingFilters } from "@/components/src/client/routes/components/bookingTable/hooks/useBookingFilters";
import { BookingStatusLabel, PageContextLevel } from "@/components/src/types";
import { renderHook } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/src/client/routes/hooks/getBookingStatus", () => ({
  default: () => BookingStatusLabel.REQUESTED,
}));

vi.mock(
  "@/components/src/client/routes/components/bookingTable/hooks/useAllowedStatuses",
  () => ({
    default: () => Object.values(BookingStatusLabel),
  }),
);

const setFilters = vi.fn();

const mockDatabaseContext = {
  liaisonUsers: [],
  userEmail: "liaison@nyu.edu",
  allBookings: [],
  setFilters,
} as any;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <DatabaseContext.Provider value={mockDatabaseContext}>
    {children}
  </DatabaseContext.Provider>
);

const renderFilters = (
  pageContext: PageContextLevel,
  selectedDateRange: string,
) =>
  renderHook(
    () =>
      useBookingFilters({
        pageContext,
        columnOrderBy: "startDate",
        columnOrder: "desc",
        selectedDateRange,
        selectedStatusFilters: [],
        searchQuery: "",
        tenant: "mc",
        selectedOrigins: [],
        selectedRooms: [],
        selectedServices: [],
      } as any),
    { wrapper },
  );

describe("useBookingFilters — server-side sortDirection", () => {
  beforeEach(() => {
    setFilters.mockClear();
  });

  it("fetches ascending for the LIAISON 'All Future' view", () => {
    // The liaison queue's open-ended future range must fetch nearest-first;
    // descending would fill the LIMIT-bounded window with farthest-future
    // bookings and near-term requests would never reach the client.
    renderFilters(PageContextLevel.LIAISON, "All Future");

    expect(setFilters).toHaveBeenCalledWith(
      expect.objectContaining({ sortDirection: "asc" }),
    );
  });

  it("keeps the default (descending) for non-LIAISON 'All Future' views", () => {
    renderFilters(PageContextLevel.ADMIN, "All Future");

    expect(setFilters).toHaveBeenCalledWith(
      expect.objectContaining({ sortDirection: undefined }),
    );
  });

  it("keeps the default (descending) for LIAISON with a bounded range", () => {
    renderFilters(PageContextLevel.LIAISON, "Today");

    expect(setFilters).toHaveBeenCalledWith(
      expect.objectContaining({ sortDirection: undefined }),
    );
  });
});
