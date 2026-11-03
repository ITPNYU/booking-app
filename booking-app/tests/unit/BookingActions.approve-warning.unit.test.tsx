import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Timestamp } from "firebase/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApprovedWithWarningError } from "../../components/src/client/bookingActionClient";
import BookingActions from "../../components/src/client/routes/admin/components/BookingActions";
import useBookingActions, {
  Actions,
} from "../../components/src/client/routes/admin/hooks/useBookingActions";
import { DatabaseContext } from "../../components/src/client/routes/components/Provider";
import {
  BookingStatusLabel,
  PageContextLevel,
} from "../../components/src/types";

vi.mock("@/lib/firebase/firebase", () => ({
  clientGetDataByCalendarEventId: vi.fn(),
}));

vi.mock(
  "../../components/src/client/routes/admin/hooks/useBookingActions",
  () => ({
    Actions: { FINAL_APPROVE: "2nd Approve", PLACEHOLDER: "Placeholder" },
    default: vi.fn(),
  }),
);

const reloadFutureBookings = vi.fn();
const setOptimisticStatus = vi.fn();

const renderWithFailingApprove = (error: Error) => {
  vi.mocked(useBookingActions).mockReturnValue({
    actions: {
      [Actions.FINAL_APPROVE]: {
        action: vi.fn().mockRejectedValue(error),
        optimisticNextStatus: BookingStatusLabel.APPROVED,
      },
      [Actions.PLACEHOLDER]: {
        action: vi.fn(),
        optimisticNextStatus: BookingStatusLabel.UNKNOWN,
      },
    },
    updateActions: vi.fn(),
    options: vi.fn().mockReturnValue([Actions.FINAL_APPROVE]),
  } as any);

  render(
    <ThemeProvider theme={createTheme()}>
      <DatabaseContext.Provider
        value={{ allBookings: [], reloadFutureBookings } as any}
      >
        <BookingActions
          status={BookingStatusLabel.PRE_APPROVED}
          calendarEventId="evt-7073"
          startDate={Timestamp.fromDate(new Date("2030-01-01T10:00:00Z"))}
          onSelect={vi.fn()}
          setOptimisticStatus={setOptimisticStatus}
          pageContext={PageContextLevel.ADMIN}
        />
      </DatabaseContext.Provider>
    </ThemeProvider>,
  );
};

const runFinalApprove = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox"));
  await user.click(screen.getByRole("option", { name: "2nd Approve" }));
  await user.click(screen.getByRole("button", { name: "Confirm 2nd Approve" }));
};

describe("BookingActions when final approval only partly succeeds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("keeps the approved status, warns, and reloads the bookings", async () => {
    const message =
      "Booking was approved, but a follow-up step failed: Google Calendar event title was not updated to [APPROVED] (calendar update returned 500)";
    renderWithFailingApprove(new ApprovedWithWarningError(message));

    await runFinalApprove();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(message);
    expect(alert).toHaveClass("MuiAlert-standardWarning");
    expect(setOptimisticStatus).toHaveBeenCalledWith(
      BookingStatusLabel.APPROVED,
    );
    expect(setOptimisticStatus).not.toHaveBeenCalledWith(undefined);
    expect(reloadFutureBookings).toHaveBeenCalled();
  });

  it("reverts the status and shows an error when approval failed", async () => {
    renderWithFailingApprove(new Error("Failed to approve booking"));

    await runFinalApprove();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to approve booking");
    expect(alert).toHaveClass("MuiAlert-standardError");
    expect(setOptimisticStatus).toHaveBeenLastCalledWith(undefined);
    expect(reloadFutureBookings).not.toHaveBeenCalled();
  });
});
