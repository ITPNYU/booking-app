import {
  BookingContext,
  DefaultBookingContext,
} from "./components/src/client/routes/booking/bookingProvider";
import {
  DatabaseContext,
  DefaultDatabaseContext,
} from "./components/src/client/routes/components/Provider";

import { Booking } from "./components/src/types";
import { ThemeProvider } from "@mui/material/styles";
import { genFakeApprovedBooking } from "./components/src/test/fakeBookingData";
import { render } from "@testing-library/react";
import theme from "./app/theme/theme";

const testBookings: Booking[] = [
  ...genFakeApprovedBooking(1, {}),
  ...genFakeApprovedBooking(1, {}),
];

const renderOverride = (ui: React.ReactElement, options = {}) => {
  const ProviderWrapper = ({ children }) => (
    <DatabaseContext.Provider
      value={{
        ...DefaultDatabaseContext,
        bookings: testBookings,
        bookingsLoading: false,
      }}
    >
      <BookingContext.Provider value={DefaultBookingContext}>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </BookingContext.Provider>
    </DatabaseContext.Provider>
  );
  return render(ui, { wrapper: ProviderWrapper, ...options });
};

export * from "@testing-library/react";
export { renderOverride as render };
