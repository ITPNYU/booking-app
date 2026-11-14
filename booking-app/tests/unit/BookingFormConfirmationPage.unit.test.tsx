import { deepPurple } from "@mui/material/colors";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BookingFormConfirmationPage from "../../components/src/client/routes/booking/formPages/BookingFormConfirmationPage";
import { BookingContext } from "../../components/src/client/routes/booking/bookingProvider";
import { DatabaseContext } from "../../components/src/client/routes/components/Provider";
import { FormContextLevel, PagePermission } from "../../components/src/types";
import type { BookingDetailsSummaryBooking } from "../../components/src/client/routes/components/bookingTable/BookingDetailsSummary";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ tenant: "mc" }),
}));

const theme = createTheme({
  palette: {
    primary: { main: deepPurple.A700, 50: deepPurple[50] },
    secondary: { main: deepPurple.A100, light: deepPurple[50] },
    custom: { border: "#e3e3e3" },
  },
} as any);

const submittedBooking: BookingDetailsSummaryBooking = {
  requestNumber: 4321,
  status: "REQUESTED",
  roomId: "202",
  title: "Studio session",
  description: "Recording",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "al@nyu.edu",
  netId: "al123",
  department: "ITP",
  role: "Student",
  phoneNumber: "555-0100",
  startDate: "2024-03-15T14:30:00-04:00",
  endDate: "2024-03-15T16:45:00-04:00",
  origin: "user",
  expectedAttendance: "8",
  attendeeAffiliation: "NYU Members with an active NYU ID",
};

const renderPage = (
  submitting: "none" | "submitting" | "success" | "error",
  booking?: BookingDetailsSummaryBooking,
) =>
  render(
    <ThemeProvider theme={theme}>
      <DatabaseContext.Provider
        value={{ pagePermission: PagePermission.BOOKING } as any}
      >
        <BookingContext.Provider
          value={
            {
              submitting,
              error: submitting === "error" ? new Error("nope") : null,
              submittedBooking: booking,
            } as any
          }
        >
          <BookingFormConfirmationPage formContext={FormContextLevel.FULL_FORM} />
        </BookingContext.Provider>
      </DatabaseContext.Provider>
    </ThemeProvider>,
  );

describe("BookingFormConfirmationPage", () => {
  it("summarizes the submitted request with the booking details sections", () => {
    renderPage("success", submittedBooking);

    expect(
      screen.getByText("Yay! We've received your booking request"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("booking-confirmation-summary")).toBeInTheDocument();
    expect(screen.getByText("Request")).toBeInTheDocument();
    expect(screen.getByText("4321")).toBeInTheDocument();
    expect(screen.getByText("REQUESTED")).toBeInTheDocument();
    expect(screen.getByText("Requester")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByText("Studio session")).toBeInTheDocument();
    expect(screen.getByText("Recording")).toBeInTheDocument();
    expect(screen.queryByText("History")).toBeNull();
    expect(screen.queryByText("Memo")).toBeNull();
    expect(screen.queryByText("WebCheckout")).toBeNull();
  });

  it("does not show a summary while the request is still submitting", () => {
    renderPage("submitting", submittedBooking);

    expect(screen.getByText(/Submitting your booking request/)).toBeInTheDocument();
    expect(screen.queryByText("Studio session")).toBeNull();
  });

  it("does not show a summary when submission fails", () => {
    renderPage("error", submittedBooking);

    expect(
      screen.getByText("Sorry, an error occurred while submitting this request"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Studio session")).toBeNull();
  });
});
