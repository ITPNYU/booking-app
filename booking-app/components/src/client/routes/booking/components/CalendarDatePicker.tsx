import { DateCalendar, LocalizationProvider } from "@mui/x-date-pickers";
import dayjs, { Dayjs } from "dayjs";
import { useContext, useEffect, useState } from "react";

import { FormContextLevel } from "@/components/src/types";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { BookingContext } from "../bookingProvider";
import { DatabaseContext } from "../../components/Provider";
import { canAccessAdmin } from "@/components/src/utils/permissions";

interface Props {
  handleChange: (x: Date) => void;
  formContext: FormContextLevel;
}

export const CalendarDatePicker = ({ handleChange, formContext }: Props) => {
  const [date, setDate] = useState<Dayjs | null>(dayjs(new Date()));
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
    return date.isBefore(dayjs(), "day");
  };

  // if go back to calendar from booking form, show currently selected date
  useEffect(() => {
    if (bookingCalendarInfo != null) {
      handleDateChange(dayjs(bookingCalendarInfo.start));
    }
  }, []);

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
        disabled={!isAdmin}
        showDaysOutsideCurrentMonth
      />
    </LocalizationProvider>
  );
};
