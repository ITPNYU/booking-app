import BookingFormConfirmationPage from "@/components/src/client/routes/booking/formPages/BookingFormConfirmationPage";
import { rememberDashboardReturn } from "@/components/src/client/routes/components/bookingTable/dashboardView";
import { BookingContext } from "@/components/src/client/routes/booking/bookingProvider";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { FormContextLevel, PagePermission } from "@/components/src/types";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, back: vi.fn() }),
  useParams: () => ({ tenant: "mc" }),
  usePathname: () => "/mc/modification/confirmation",
  useSearchParams: () => new URLSearchParams(),
}));

function renderConfirmation(
  formContext: FormContextLevel,
  pagePermission: PagePermission,
) {
  return render(
    <ThemeProvider theme={createTheme()}>
      <DatabaseContext.Provider value={{ pagePermission } as any}>
        <BookingContext.Provider
          value={{ submitting: "success", error: null } as any}
        >
          <BookingFormConfirmationPage formContext={formContext} />
        </BookingContext.Provider>
      </DatabaseContext.Provider>
    </ThemeProvider>,
  );
}

describe("confirmation return after modification", () => {
  beforeEach(() => {
    replace.mockClear();
    push.mockClear();
    sessionStorage.clear();
    window.history.pushState({}, "", "/mc/services?q=jane&range=Today");
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("sends staff back to the dashboard they modified from", async () => {
    rememberDashboardReturn("modification");

    renderConfirmation(FormContextLevel.MODIFICATION, PagePermission.ADMIN);

    expect(
      screen.queryByText(/We've received your booking request/i),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/mc/services?q=jane&range=Today"),
    );
  });

  it("still shows the received message for a new booking", () => {
    renderConfirmation(FormContextLevel.FULL_FORM, PagePermission.BOOKING);

    expect(
      screen.getByText("Yay! We've received your booking request"),
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
