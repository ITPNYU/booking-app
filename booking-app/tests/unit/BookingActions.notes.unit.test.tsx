import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen, waitFor, within } from "@testing-library/react";
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

const renderActions = (pageContext = PageContextLevel.ADMIN) => {
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
          pageContext={pageContext}
          setOptimisticStatus={vi.fn()}
          status={BookingStatusLabel.APPROVED}
          startDate={Timestamp.fromDate(new Date("2026-11-02T15:00:00Z"))}
        />
      </DatabaseContext.Provider>
    </ThemeProvider>,
  );
};

const choose = async (
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) => {
  await user.click(screen.getByRole("combobox"));
  await user.click(screen.getByRole("option", { name }));
};

const addNote = async (
  user: ReturnType<typeof userEvent.setup>,
  text: string,
) => {
  await user.click(screen.getByRole("button", { name: "Add a note" }));
  await user.type(await screen.findByRole("textbox"), text);
  await user.click(screen.getByRole("button", { name: "Done" }));
};

describe("BookingActions notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs an action straight away, with no dialog and no note", async () => {
    const user = userEvent.setup();
    renderActions();

    await choose(user, "Check Out");
    await user.click(screen.getByRole("button", { name: "Confirm Check Out" }));

    expect(mockRunAction).toHaveBeenCalledWith("Check Out", "");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("sends the optional note added next to the check button", async () => {
    const user = userEvent.setup();
    renderActions();

    await choose(user, "Check Out");
    await addNote(user, "Room left tidy");
    expect(
      screen.getByRole("button", { name: "Edit note" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm Check Out" }));

    expect(mockRunAction).toHaveBeenCalledWith("Check Out", "Room left tidy");
  });

  it("keeps the late-cancelation confirmation for Cancel and sends its note", async () => {
    const user = userEvent.setup();
    renderActions();

    await choose(user, "Cancel");
    await addNote(user, "Requester asked by email");
    await user.click(screen.getByRole("button", { name: "Confirm Cancel" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/counted as a Late Cancelation/),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Ok" }));

    expect(mockRunAction).toHaveBeenCalledWith(
      "Cancel",
      "Requester asked by email",
    );
  });

  it("still requires a reason to decline, with no separate note button", async () => {
    const user = userEvent.setup();
    renderActions();

    await choose(user, "Decline");
    expect(
      screen.queryByRole("button", { name: "Add a note" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm decline" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Ok" })).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox"), "Room is closed");
    await user.click(within(dialog).getByRole("button", { name: "Ok" }));

    expect(mockRunAction).toHaveBeenCalledWith("Decline", "Room is closed");
  });

  it("requires a reason to decline a service", async () => {
    const user = userEvent.setup();
    renderActions();

    await choose(user, "Decline Catering");
    await user.click(
      screen.getByRole("button", { name: "Confirm Decline Catering" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Decline Catering")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Ok" })).toBeDisabled();
  });

  it("drops a note when a different action is chosen", async () => {
    const user = userEvent.setup();
    renderActions();

    await choose(user, "Check Out");
    await addNote(user, "Meant for check out");
    await choose(user, "Cancel");

    expect(
      screen.getByRole("button", { name: "Add a note" }),
    ).toBeInTheDocument();
  });

  it("clears the note after the action runs", async () => {
    const user = userEvent.setup();
    renderActions();

    await choose(user, "Check Out");
    await addNote(user, "First note");
    await user.click(screen.getByRole("button", { name: "Confirm Check Out" }));
    await waitFor(() => expect(mockRunAction).toHaveBeenCalledTimes(1));

    await choose(user, "Check Out");
    await user.click(screen.getByRole("button", { name: "Confirm Check Out" }));
    expect(mockRunAction).toHaveBeenLastCalledWith("Check Out", "");
  });

  it("offers no note for Edit, which opens another page", async () => {
    const user = userEvent.setup();
    renderActions();

    await choose(user, "Edit");

    expect(
      screen.queryByRole("button", { name: "Add a note" }),
    ).not.toBeInTheDocument();
  });

  it("offers no note button on the requester's own page", async () => {
    const user = userEvent.setup();
    renderActions(PageContextLevel.USER);

    await choose(user, "Cancel");

    expect(
      screen.queryByRole("button", { name: "Add a note" }),
    ).not.toBeInTheDocument();
  });
});
