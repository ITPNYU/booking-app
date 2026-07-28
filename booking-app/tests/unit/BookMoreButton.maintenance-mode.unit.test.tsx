import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import BookMoreButton from "@/components/src/client/routes/components/bookingTable/BookMoreButton";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";

vi.mock("next/navigation", () => ({
  useParams: () => ({ tenant: "mc" }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock(
  "@/components/src/client/routes/booking/hooks/useHandleStartBooking",
  () => ({
    default: () => vi.fn(),
  }),
);

function renderBookMoreButton(enabled: boolean) {
  render(
    <DatabaseContext.Provider
      value={
        {
          maintenanceMode: {
            enabled,
            message: "Requests are paused.",
          },
        } as any
      }
    >
      <BookMoreButton />
    </DatabaseContext.Provider>,
  );
}

describe("BookMoreButton maintenance mode", () => {
  it("hides the booking entry point during maintenance mode", () => {
    renderBookMoreButton(true);

    expect(
      screen.queryByRole("button", { name: /request a reservation/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the booking entry point when maintenance mode is disabled", () => {
    renderBookMoreButton(false);

    expect(
      screen.getByRole("button", { name: /request a reservation/i }),
    ).toBeInTheDocument();
  });
});
