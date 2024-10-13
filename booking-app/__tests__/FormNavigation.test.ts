// __tests__/LandingPage.test.tsx
import { render, screen } from "testUtils";

import { MockAuthentication } from "firebase-mock";
import MyBookingsPage from "@/components/src/client/routes/myBookings/myBookingsPage";
import { useRouter } from "next/navigation";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("../lib/firebase/firebaseClient.ts", () => ({
  auth: new MockAuthentication(),
}));

jest.mock(
  "../components/src/client/routes/components/AuthProvider.tsx",
  () => ({
    useAuth: {
      user: {
        email: "abc12345",
      },
      loading: false,
      error: null,
    },
  })
);

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
