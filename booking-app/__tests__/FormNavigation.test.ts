import { render, screen } from "testUtils";

import MyBookingsPage from "@/components/src/client/routes/myBookings/myBookingsPage";
import { useRouter } from "next/navigation";

describe("Form Navigation", () => {
  it('My Bookings page "book more" button goes to form landing page', () => {
    // Mock the `push` function
    const push = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({
      push,
    });

    render(MyBookingsPage());

    const button = screen.getByTestId("book-btn");
    button.click();

    expect(push).toHaveBeenCalledWith("/book");
  });
});
