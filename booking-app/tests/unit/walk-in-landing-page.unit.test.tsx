import WalkInLandingPage from "@/components/src/client/routes/walk-in/DirectLandingPage";
import { FormContextLevel } from "@/components/src/types";
import theme from "@/app/theme/theme";
import { ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import { useParams, useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
}));

const renderPage = (formContext?: FormContextLevel) =>
  render(
    <ThemeProvider theme={theme}>
      <WalkInLandingPage formContext={formContext} />
    </ThemeProvider>,
  );

describe("WalkInLandingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      push: vi.fn(),
    });
    (useParams as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: "mc",
    });
  });

  it("shows the walk-in policy reminders for PAs", () => {
    renderPage();

    expect(screen.getByText("Policy Reminders")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Walk in reservations are only available to members from our primary stakeholder departments.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Always ask the reservation holder how they plan to use our production spaces and mark it in the reservation details.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "If you are unsure if the walk in request follows studio policy, reach out to a full time employee.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Audio Lab (230) has different hours for Walk-Ins"),
    ).not.toBeInTheDocument();
  });

  it("keeps the VIP reminders on the VIP form", () => {
    renderPage(FormContextLevel.VIP);

    expect(
      screen.getByText("No approval process is required for these bookings."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Walk in reservations are only available to members from our primary stakeholder departments.",
      ),
    ).not.toBeInTheDocument();
  });
});
