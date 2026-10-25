import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Timestamp } from "firebase/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BookingActions from "../../components/src/client/routes/admin/components/BookingActions";
import useBookingActions from "../../components/src/client/routes/admin/hooks/useBookingActions";
import { DatabaseContext } from "../../components/src/client/routes/components/Provider";
import {
  BookingStatusLabel,
  PageContextLevel,
} from "../../components/src/types";

vi.mock(
  "../../components/src/client/routes/admin/hooks/useBookingActions",
  () => ({
    Actions: {
      CANCEL: "Cancel",
      CHECK_IN: "Check In",
      DECLINE: "Decline",
      DECLINE_CATERING_SERVICE: "Decline Catering",
      EDIT: "Edit",
      PLACEHOLDER: "",
    },
    default: vi.fn(),
  }),
);

// Each action reports the note the hook was given when it ran.
const mockRunAction = vi.fn();

const renderActions = () => {
  vi.mocked(useBookingActions).mockImplementation(({ note }) => {
    const action = (name: string) => ({
      action: async () => mockRunAction(name, note),
      optimisticNextStatus: BookingStatusLabel.UNKNOWN,
    });
    return {
      actions: {
        Cancel: action("Cancel"),
        "Check Out": action("Check Out"),
        Decline: action("Decline"),
        "Decline Catering": action("Decline Catering"),
        Edit: action("Edit"),
        "": action(""),
      },
      updateActions: vi.fn(),
      options: () => [
        "Cancel",
        "Check Out",
        "Decline",
        "Decline Catering",
        "Edit",
      ],
    } as any;
  });

  return render(
    <ThemeProvider theme={createTheme()}>
      <DatabaseContext.Provider
        value={
          {
            userEmail: "pa@nyu.edu",
            allBookings: [],
            reloadFutureBookings: vi.fn(),
          } as any
        }
      >
        <BookingActions
          calendarEventId="evt-1"
          onSelect={vi.fn()}
          pageContext={PageContextLevel.ADMIN}
          setOptimisticStatus={vi.fn()}
          status={BookingStatusLabel.APPROVED}
          startDate={Timestamp.fromDate(new Date("2026-11-02T15:00:00Z"))}
        />
      </DatabaseContext.Provider>
    </ThemeProvider>,
  );
};

const chooseAction = async (
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  confirmLabel = `Confirm ${name}`,
) => {
  await user.click(screen.getByRole("combobox"));
  await user.click(screen.getByRole("option", { name }));
  await user.click(screen.getByRole("button", { name: confirmLabel }));
};

describe("BookingActions notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs Check Out with the optional note typed in the dialog", async () => {
    const user = userEvent.setup();
    renderActions();

    await chooseAction(user, "Check Out");
    expect(
      screen.getByText(
        "You can add a note. It will appear in the booking history.",
      ),
    ).toBeInTheDocument();
    await user.type(
      screen.getByLabelText("Note (optional)"),
      "Room left tidy",
    );
    await user.click(screen.getByRole("button", { name: "Ok" }));

    expect(mockRunAction).toHaveBeenCalledWith(
      "Check Out",
      "Room left tidy",
    );
  });

  it("lets Check Out go ahead without a note", async () => {
    const user = userEvent.setup();
    renderActions();

    await chooseAction(user, "Check Out");
    await user.click(screen.getByRole("button", { name: "Ok" }));

    expect(mockRunAction).toHaveBeenCalledWith("Check Out", "");
  });

  it("keeps the late-cancelation warning in the cancel dialog and sends its note", async () => {
    const user = userEvent.setup();
    renderActions();

    await chooseAction(user, "Cancel");
    expect(screen.getByText("Cancel Booking")).toBeInTheDocument();
    expect(
      screen.getByText(/counted as a Late Cancelation/),
    ).toBeInTheDocument();
    await user.type(
      screen.getByLabelText("Note (optional)"),
      "Requester asked by email",
    );
    await user.click(screen.getByRole("button", { name: "Ok" }));

    expect(mockRunAction).toHaveBeenCalledWith(
      "Cancel",
      "Requester asked by email",
    );
  });

  it("still requires a reason to decline", async () => {
    const user = userEvent.setup();
    renderActions();

    await chooseAction(user, "Decline", "Confirm decline");
    expect(screen.getByRole("button", { name: "Ok" })).toBeDisabled();
    await user.type(screen.getByLabelText(/Reason/), "Room is closed");
    await user.click(screen.getByRole("button", { name: "Ok" }));

    expect(mockRunAction).toHaveBeenCalledWith("Decline", "Room is closed");
  });

  it("requires a reason to decline a service", async () => {
    const user = userEvent.setup();
    renderActions();

    await chooseAction(user, "Decline Catering");
    expect(
      within(screen.getByRole("dialog")).getByText("Decline Catering"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ok" })).toBeDisabled();
  });

  it("clears the note after the action runs", async () => {
    const user = userEvent.setup();
    renderActions();

    await chooseAction(user, "Check Out");
    await user.type(screen.getByLabelText("Note (optional)"), "First note");
    await user.click(screen.getByRole("button", { name: "Ok" }));
    await screen.findByRole("combobox");

    await chooseAction(user, "Cancel");
    expect(screen.getByLabelText("Note (optional)")).toHaveValue("");
  });

  it("runs Edit straight away, without a note dialog", async () => {
    const user = userEvent.setup();
    renderActions();

    await chooseAction(user, "Edit");

    expect(mockRunAction).toHaveBeenCalledWith("Edit", "");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
