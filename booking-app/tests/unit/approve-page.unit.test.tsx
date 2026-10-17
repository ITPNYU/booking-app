import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Timestamp } from "firebase/firestore";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockClientApproveBooking = vi.fn();
const mockDecline = vi.fn();
const mockClientGetDataByCalendarEventId = vi.fn();
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("calendarEventId=evt-7073"),
  useParams: () => ({ tenant: "itp" }),
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock("@/components/src/client/bookingActionClient", () => {
  class ApprovedWithWarningError extends Error {}
  class NotAnApproverError extends Error {}
  return {
    ApprovedWithWarningError,
    NotAnApproverError,
    clientApproveBooking: (...args: unknown[]) =>
      mockClientApproveBooking(...args),
    decline: (...args: unknown[]) => mockDecline(...args),
  };
});

vi.mock("@/lib/firebase/firebase", () => ({
  clientGetDataByCalendarEventId: (...args: unknown[]) =>
    mockClientGetDataByCalendarEventId(...args),
}));

vi.mock("@/components/src/client/routes/components/Provider", () => ({
  DatabaseContext: React.createContext({}),
}));

import ApprovePage from "@/app/[tenant]/approve/page";
import {
  ApprovedWithWarningError,
  NotAnApproverError,
} from "@/components/src/client/bookingActionClient";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { TableNames } from "@/components/src/policy";
import { BookingStatusLabel, PagePermission } from "@/components/src/types";

const booking = {
  id: "booking-db-id",
  calendarEventId: "evt-7073",
  requestNumber: 7073,
  title: "Thesis critique",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "requester@nyu.edu",
  roomId: "221, 222",
  startDate: Timestamp.fromDate(new Date("2026-10-20T14:00:00Z")),
  endDate: Timestamp.fromDate(new Date("2026-10-20T16:00:00Z")),
  status: BookingStatusLabel.PRE_APPROVED,
};

const renderPage = (context: Record<string, unknown> = {}) =>
  render(
    <DatabaseContext.Provider
      value={
        {
          userEmail: "approver@nyu.edu",
          pagePermission: PagePermission.BOOKING,
          permissionsLoading: false,
          ...context,
        } as any
      }
    >
      <ApprovePage />
    </DatabaseContext.Provider>,
  );

const clickApprove = async () =>
  fireEvent.click(
    await screen.findByRole("button", { name: "Approve Booking" }),
  );

describe("approve page", () => {
  beforeEach(() => {
    mockClientApproveBooking.mockReset();
    mockDecline.mockReset();
    mockClientGetDataByCalendarEventId.mockReset();
    mockClientGetDataByCalendarEventId.mockResolvedValue(booking);
    mockReplace.mockReset();
  });

  it.each([PagePermission.ADMIN, PagePermission.SUPER_ADMIN])(
    "sends a %s on to the admin page",
    async (pagePermission) => {
      renderPage({ pagePermission });

      await waitFor(() =>
        expect(mockReplace).toHaveBeenCalledWith(
          "/itp/admin?calendarEventId=evt-7073",
        ),
      );
      expect(mockClientGetDataByCalendarEventId).not.toHaveBeenCalled();
      expect(screen.queryByRole("button")).toBeNull();
    },
  );

  it("waits for permissions before choosing between the two pages", () => {
    renderPage({ permissionsLoading: true });

    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockClientGetDataByCalendarEventId).not.toHaveBeenCalled();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("lets a non-admin approver review and approve the booking in its tenant", async () => {
    mockClientApproveBooking.mockResolvedValue(undefined);

    renderPage();

    expect(await screen.findByText("Title: Thesis critique")).toBeInTheDocument();
    expect(mockClientGetDataByCalendarEventId).toHaveBeenCalledWith(
      TableNames.BOOKING,
      "evt-7073",
      "itp",
    );
    expect(screen.getByText("Request #7073")).toBeInTheDocument();
    expect(
      screen.getByText("Requested by: Ada Lovelace (requester@nyu.edu)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Rooms: 221, 222")).toBeInTheDocument();
    expect(screen.getByText("Status: PRE-APPROVED")).toBeInTheDocument();

    await clickApprove();

    expect(
      await screen.findByRole("button", { name: "Approved" }),
    ).toBeDisabled();
    expect(mockClientApproveBooking).toHaveBeenCalledWith(
      "evt-7073",
      "approver@nyu.edu",
      "itp",
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("tells a viewer who is not an approver for the booking", async () => {
    mockClientApproveBooking.mockRejectedValue(
      new NotAnApproverError("You are not authorized to approve this booking"),
    );

    renderPage();
    await clickApprove();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You are not an approver for this booking, so you can't approve or decline it.",
    );
    expect(
      screen.getByRole("button", { name: "Approve Booking" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Decline Booking" }),
    ).toBeDisabled();
  });

  it("lets a non-admin approver decline the booking with a reason", async () => {
    mockDecline.mockResolvedValue(undefined);

    renderPage();
    const declineButton = await screen.findByRole("button", {
      name: "Decline Booking",
    });
    expect(declineButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Reason for declining"), {
      target: { value: "  Room is closed that week  " },
    });
    expect(declineButton).toBeEnabled();
    fireEvent.click(declineButton);

    expect(
      await screen.findByRole("button", { name: "Declined" }),
    ).toBeDisabled();
    expect(mockDecline).toHaveBeenCalledWith(
      "evt-7073",
      "approver@nyu.edu",
      "Room is closed that week",
      "itp",
    );
    expect(
      screen.getByRole("button", { name: "Approve Booking" }),
    ).toBeDisabled();
    expect(mockClientApproveBooking).not.toHaveBeenCalled();
  });

  it("tells a viewer who is not an approver when they try to decline", async () => {
    mockDecline.mockRejectedValue(
      new NotAnApproverError("You are not authorized to decline this booking"),
    );

    renderPage();
    fireEvent.change(await screen.findByLabelText("Reason for declining"), {
      target: { value: "Conflicts with a class" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Decline Booking" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You are not an approver for this booking, so you can't approve or decline it.",
    );
    expect(
      screen.getByRole("button", { name: "Decline Booking" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Approve Booking" }),
    ).toBeDisabled();
  });

  it("shows the server's message and allows a retry when declining failed", async () => {
    mockDecline.mockRejectedValue(new Error("Booking not found"));

    renderPage();
    fireEvent.change(await screen.findByLabelText("Reason for declining"), {
      target: { value: "Conflicts with a class" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Decline Booking" }));

    expect(await screen.findByText("Booking not found")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Decline Booking" }),
    ).toBeEnabled();
  });

  it("does not offer decline once the booking is approved", async () => {
    mockClientApproveBooking.mockResolvedValue(undefined);

    renderPage();
    await clickApprove();

    await screen.findByRole("button", { name: "Approved" });
    expect(screen.getByLabelText("Reason for declining")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Decline Booking" }),
    ).toBeDisabled();
  });

  it.each([BookingStatusLabel.APPROVED, BookingStatusLabel.DECLINED])(
    "does not offer approval for a %s booking",
    async (status) => {
      mockClientGetDataByCalendarEventId.mockResolvedValue({
        ...booking,
        status,
      });

      renderPage();

      expect(
        await screen.findByText(
          `This booking is ${status}, so there is nothing to approve or decline.`,
        ),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button")).toBeNull();
    },
  );

  it("says so when no booking matches the link", async () => {
    mockClientGetDataByCalendarEventId.mockResolvedValue(null);

    renderPage();

    expect(
      await screen.findByText("No booking was found for this link."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("marks the booking approved and warns when a follow-up step failed", async () => {
    const message =
      "Booking was approved, but a follow-up step failed: Google Calendar event title was not updated to [APPROVED] (calendar update returned 500)";
    mockClientApproveBooking.mockRejectedValue(
      new ApprovedWithWarningError(message),
    );

    renderPage();
    await clickApprove();

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    // Approval is not offered again, so finalApprove cannot re-run.
    expect(screen.getByRole("button", { name: "Approved" })).toBeDisabled();
    expect(screen.queryByText("Failed to approve booking.")).toBeNull();
  });

  it("shows the server's message and allows a retry when approval failed", async () => {
    const message =
      "This request is in the services approval flow. Complete or decline each service request before final approval, or refresh the page.";
    mockClientApproveBooking.mockRejectedValue(new Error(message));

    renderPage();
    await clickApprove();

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Approve Booking" }),
    ).toBeEnabled();
  });

  it("falls back to the generic message when the error has none", async () => {
    mockClientApproveBooking.mockRejectedValue(new Error(""));

    renderPage();
    await clickApprove();

    expect(
      await screen.findByText("Failed to approve booking."),
    ).toBeInTheDocument();
  });
});
