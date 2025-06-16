import { DateCalendar, LocalizationProvider } from "@mui/x-date-pickers";
import dayjs, { Dayjs } from "dayjs";
import { useContext, useEffect, useState } from "react";

import { FormContextLevel } from "@/components/src/types";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { BookingContext } from "../bookingProvider";
import { useBookingDateRestrictions } from "../hooks/useBookingDateRestrictions";

interface Props {
  handleChange: (x: Date) => void;
  formContext: FormContextLevel;
}

export const CalendarDatePicker = ({ handleChange, formContext }: Props) => {
  const [date, setDate] = useState<Dayjs | null>(dayjs(new Date()));
  const { bookingCalendarInfo } = useContext(BookingContext);
  const { isDateDisabled } = useBookingDateRestrictions();

  const handleDateChange = (newVal: Dayjs) => {
    setDate(newVal);
    handleChange(newVal.toDate());
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
        shouldDisableDate={isDateDisabled}
        disabled={formContext === FormContextLevel.MODIFICATION}
        showDaysOutsideCurrentMonth
      />
    </LocalizationProvider>
  );
};
