import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockClientApproveBooking = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("calendarEventId=evt-7073"),
}));

vi.mock("@/components/src/client/bookingActionClient", () => ({
  clientApproveBooking: (...args: unknown[]) =>
    mockClientApproveBooking(...args),
}));

vi.mock("@/components/src/client/routes/components/Provider", () => {
  const DatabaseContext = React.createContext({ userEmail: "admin@nyu.edu" });
  return {
    DatabaseContext,
    DatabaseProvider: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

import ApprovePage from "@/app/[tenant]/approve/page";

describe("approve page", () => {
  beforeEach(() => {
    mockClientApproveBooking.mockReset();
  });

  it("shows the server's message when approval only partly succeeded", async () => {
    const message =
      "Booking was approved, but a follow-up step failed: Google Calendar event title was not updated to [APPROVED] (calendar update returned 500)";
    mockClientApproveBooking.mockRejectedValue(new Error(message));

    render(<ApprovePage />);
    fireEvent.click(screen.getByRole("button", { name: "Approve Booking" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByText("Failed to approve booking.")).toBeNull();
  });

  it("falls back to the generic message when the error has none", async () => {
    mockClientApproveBooking.mockRejectedValue(new Error(""));

    render(<ApprovePage />);
    fireEvent.click(screen.getByRole("button", { name: "Approve Booking" }));

    expect(
      await screen.findByText("Failed to approve booking."),
    ).toBeInTheDocument();
  });
});
