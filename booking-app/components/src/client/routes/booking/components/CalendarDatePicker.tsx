import { DateCalendar, LocalizationProvider } from "@mui/x-date-pickers";
import dayjs, { Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { useContext, useEffect, useState } from "react";

import { FormContextLevel } from "@/components/src/types";
import { canAccessAdmin } from "@/components/src/utils/permissions";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { BookingContext } from "../bookingProvider";
import { TIMEZONE } from "../../../utils/date";
import { DatabaseContext } from "../../components/Provider";

// Configure dayjs to use Eastern timezone
dayjs.extend(utc);
dayjs.extend(timezone);

interface Props {
  handleChange: (x: Date) => void;
  formContext: FormContextLevel;
}

export const CalendarDatePicker = ({ handleChange, formContext }: Props) => {
  // Use Eastern timezone for the date picker
  const [date, setDate] = useState<Dayjs | null>(dayjs.tz(new Date(), TIMEZONE));
  const { bookingCalendarInfo } = useContext(BookingContext);
  const { pagePermission } = useContext(DatabaseContext);

  // Only admins can change dates in modification mode
  const isAdmin = canAccessAdmin(pagePermission);

  const handleDateChange = (newVal: Dayjs) => {
    setDate(newVal);
    handleChange(newVal.toDate());
  };

  // Create a date validation function that only disables past dates
  const shouldDisableDate = (date: Dayjs) => {
    // Only disable past dates - allow blackout periods to be selected
    // Time restrictions will be handled in the calendar view
    // Compare in Eastern timezone
    return date.isBefore(dayjs.tz(undefined, TIMEZONE), "day");
  };

  // if go back to calendar from booking form, show currently selected date
  useEffect(() => {
    if (bookingCalendarInfo != null) {
      // Use Eastern timezone when showing the selected date
      handleDateChange(dayjs.tz(bookingCalendarInfo.start, TIMEZONE));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount - handleChange is stable from props

  if (formContext === FormContextLevel.WALK_IN) {
    return <div />;
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <DateCalendar
        value={date}
        onChange={handleDateChange}
        views={["day", "month"]}
        autoFocus
        disablePast
        shouldDisableDate={shouldDisableDate}
        disabled={formContext === FormContextLevel.MODIFICATION && !isAdmin}
        showDaysOutsideCurrentMonth
      />
    </LocalizationProvider>
  );
};
