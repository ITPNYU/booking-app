import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Admin from "@/components/src/client/routes/admin/components/Admin";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { PagePermission } from "@/components/src/types";

vi.mock("@/components/src/client/routes/admin/components/Settings", () => ({
  default: () => <div>Full settings</div>,
}));

vi.mock(
  "@/components/src/client/routes/components/bookingTable/Bookings",
  () => ({
    Bookings: () => <div>Bookings table</div>,
  }),
);

const renderAdmin = (pagePermission: PagePermission) => {
  render(
    <DatabaseContext.Provider
      value={
        {
          adminUsers: [{ email: "admin@nyu.edu" }],
          maintenanceMode: {
            enabled: true,
            message: "Requests are paused.",
          },
          pagePermission,
          userEmail: "requester@nyu.edu",
        } as any
      }
    >
      <Admin calendarEventId={undefined} />
    </DatabaseContext.Provider>,
  );
};

describe("Admin maintenance mode authorization", () => {
  it("does not expose the admin dashboard to booking users", () => {
    renderAdmin(PagePermission.BOOKING);

    expect(
      screen.getByText("You do not have permission to view this page."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Bookings table")).not.toBeInTheDocument();
  });

  it("keeps the admin dashboard available to admins", () => {
    renderAdmin(PagePermission.ADMIN);

    expect(screen.getByText("Bookings table")).toBeInTheDocument();
    expect(
      screen.queryByText("You do not have permission to view this page."),
    ).not.toBeInTheDocument();
  });

  it("keeps the admin dashboard available to super admins", () => {
    renderAdmin(PagePermission.SUPER_ADMIN);

    expect(screen.getByText("Bookings table")).toBeInTheDocument();
  });
});
