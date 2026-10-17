import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDecline = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("calendarEventId=evt-7780"),
  useParams: () => ({ tenant: "mc" }),
}));

vi.mock("@/components/src/client/bookingActionClient", () => {
  class NotAnApproverError extends Error {}
  return {
    NotAnApproverError,
    decline: (...args: unknown[]) => mockDecline(...args),
  };
});

vi.mock("@/components/src/client/routes/components/Provider", () => {
  const DatabaseContext = React.createContext({ userEmail: "liaison@nyu.edu" });
  return {
    DatabaseContext,
    DatabaseProvider: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

import DeclinePage from "@/app/[tenant]/decline/page";
import { NotAnApproverError } from "@/components/src/client/bookingActionClient";

const declineWithReason = () => {
  fireEvent.change(screen.getByLabelText(/Reason for Declining/), {
    target: { value: "No staff available" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Decline Booking" }));
};

describe("decline page", () => {
  beforeEach(() => {
    mockDecline.mockReset();
  });

  it("declines the booking in the page's tenant", async () => {
    mockDecline.mockResolvedValue(undefined);

    render(<DeclinePage />);
    declineWithReason();

    expect(
      await screen.findByRole("button", { name: "Declined" }),
    ).toBeDisabled();
    expect(mockDecline).toHaveBeenCalledWith(
      "evt-7780",
      "liaison@nyu.edu",
      "No staff available",
      "mc",
    );
  });

  it("tells a viewer who is not an approver for the booking", async () => {
    mockDecline.mockRejectedValue(
      new NotAnApproverError("You are not authorized to decline this booking"),
    );

    render(<DeclinePage />);
    declineWithReason();

    expect(
      await screen.findByText(
        "You are not an approver for this booking, so you can't decline it.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the server's message when declining failed", async () => {
    mockDecline.mockRejectedValue(new Error("Unauthorized"));

    render(<DeclinePage />);
    declineWithReason();

    expect(await screen.findByText("Unauthorized")).toBeInTheDocument();
  });

  it("falls back to the generic message when the error has none", async () => {
    mockDecline.mockRejectedValue(new Error(""));

    render(<DeclinePage />);
    declineWithReason();

    expect(
      await screen.findByText("Failed to decline booking."),
    ).toBeInTheDocument();
  });
});
