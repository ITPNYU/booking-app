import { fireEvent, render, screen, within } from "testUtils";

import Bookings from "@/components/src/client/routes/components/bookingTable/Bookings";
import MockDate from "mockdate";
import { PageContextLevel } from "@/components/src/types";

function clickActions() {
  render(<Bookings pageContext={PageContextLevel.PA} />);

  // click the 'All' date filter
  const dateSelect = screen.getByTestId("dropdown-date-range");
  const dropdown = within(dateSelect).getByRole("combobox");
  fireEvent.mouseDown(dropdown);
  const option = screen.getByRole("option", { name: "All" });
  fireEvent.click(option);

  // verify 2 bookings show up with selected filters
  const actions = screen.getAllByTestId("actions");
  expect(actions).toHaveLength(2);

  // No Show action shouldn't show up yet
  let actionsSelect = screen.getAllByTestId("actions")[0];
  let actionsDropdown = within(actionsSelect).getByRole("combobox");
  fireEvent.mouseDown(actionsDropdown);
}

describe("PA Actions", () => {
  it("PA No-Show action isn't visible until 30min after booking start time", () => {
    clickActions();
    const noShowOption = screen.queryByTestId("action-No Show");
    expect(noShowOption).toBeNull();
  });

  it("PA No-Show action is visible 30min after booking start time", () => {
    MockDate.set(Date.now() + 30 * 60 * 1000);

    clickActions();
    const noShowOption = screen.queryByTestId("action-No Show");
    expect(noShowOption).not.toBeNull();

    MockDate.reset();
  });
});
