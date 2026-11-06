import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Timestamp } from "firebase/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clientAddBookingNote } from "../../components/src/client/bookingActionClient";
import AddHistoryNote from "../../components/src/client/routes/components/bookingTable/AddHistoryNote";
import MoreInfoModal from "../../components/src/client/routes/components/bookingTable/MoreInfoModal";
import { DatabaseContext } from "../../components/src/client/routes/components/Provider";
import {
  BookingRow,
  PageContextLevel,
  PagePermission,
} from "../../components/src/types";

vi.mock("../../components/src/client/bookingActionClient", () => ({
  clientAddBookingNote: vi.fn(),
}));

vi.mock(
  "../../components/src/client/routes/hooks/useSortBookingHistory",
  () => ({ default: () => null }),
);

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({}),
});

const theme = createTheme({
  palette: { custom: { border: "#e3e3e3" } },
} as any);

describe("AddHistoryNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderNote = (onAdded = vi.fn()) => {
    render(
      <AddHistoryNote calendarEventId="evt-1" tenant="mc" onAdded={onAdded} />,
    );
    return onAdded;
  };

  it("saves a trimmed note and reloads the history", async () => {
    vi.mocked(clientAddBookingNote).mockResolvedValue(undefined);
    const user = userEvent.setup();
    const onAdded = renderNote();

    await user.click(screen.getByRole("button", { name: "Add note" }));
    expect(screen.getByRole("button", { name: "Save note" })).toBeDisabled();
    await user.type(
      screen.getByRole("textbox", { name: "Note" }),
      "  Called about parking ",
    );
    await user.click(screen.getByRole("button", { name: "Save note" }));

    expect(clientAddBookingNote).toHaveBeenCalledWith(
      "evt-1",
      "Called about parking",
      "mc",
    );
    expect(onAdded).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Add note" }),
    ).toBeInTheDocument();
  });

  it("keeps the note and shows the error when saving fails", async () => {
    vi.mocked(clientAddBookingNote).mockRejectedValue(
      new Error("Only staff can add notes to a booking"),
    );
    const user = userEvent.setup();
    const onAdded = renderNote();

    await user.click(screen.getByRole("button", { name: "Add note" }));
    await user.type(screen.getByRole("textbox", { name: "Note" }), "Hi");
    await user.click(screen.getByRole("button", { name: "Save note" }));

    expect(
      await screen.findByText("Only staff can add notes to a booking"),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Note" })).toHaveValue("Hi");
    expect(onAdded).not.toHaveBeenCalled();
  });
});

describe("MoreInfoModal history notes", () => {
  const booking = {
    requestNumber: 1,
    calendarEventId: "evt-1",
    startDate: Timestamp.fromDate(new Date("2026-11-03T15:00:00Z")),
    endDate: Timestamp.fromDate(new Date("2026-11-03T16:00:00Z")),
    requestedAt: Timestamp.fromDate(new Date("2026-11-01T15:00:00Z")),
    roomId: "202",
    email: "requester@nyu.edu",
    status: "REQUESTED",
  } as unknown as BookingRow;

  const renderModal = (pageContext?: PageContextLevel) =>
    render(
      <ThemeProvider theme={theme}>
        <DatabaseContext.Provider
          value={
            {
              pagePermission: PagePermission.PA,
              userEmail: "pa@nyu.edu",
              roomSettings: [],
            } as any
          }
        >
          <MoreInfoModal
            booking={booking}
            closeModal={vi.fn()}
            pageContext={pageContext}
          />
        </DatabaseContext.Provider>
      </ThemeProvider>,
    );

  it("lets staff add a note from the history", () => {
    renderModal(PageContextLevel.PA);

    expect(
      screen.getByRole("button", { name: "Add note" }),
    ).toBeInTheDocument();
  });

  it("hides it on the requester's own page", () => {
    renderModal(PageContextLevel.USER);

    expect(
      screen.queryByRole("button", { name: "Add note" }),
    ).not.toBeInTheDocument();
  });
});
