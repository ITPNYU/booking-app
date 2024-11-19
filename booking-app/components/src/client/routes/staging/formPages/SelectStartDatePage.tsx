import { DateCalendar, LocalizationProvider } from "@mui/x-date-pickers";
import dayjs, { Dayjs } from "dayjs";
import { useContext, useState } from "react";

import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { BookingContext } from "../../../providers/BookingFormProvider";

export default function SelectStartDatePage() {
  const { setBookingCalendarInfo } = useContext(BookingContext);
  const [date, setDate] = useState<Dayjs | null>(dayjs(new Date()));

  const handleDateChange = (newVal: Dayjs) => {
    setDate(newVal);

    const midnightToday = newVal.toDate();
    midnightToday.setHours(0, 0, 0, 0);
    const twoWeeksLater = new Date(midnightToday);
    twoWeeksLater.setDate(midnightToday.getDate() + 14);

    setBookingCalendarInfo({
      start: midnightToday,
      end: twoWeeksLater,
      startStr: midnightToday.toISOString(),
      endStr: twoWeeksLater.toISOString(),
      allDay: true,
      jsEvent: null,
      view: null,
    });
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <DateCalendar
        value={date}
        onChange={handleDateChange}
        views={["day"]}
        disablePast
        showDaysOutsideCurrentMonth
      />
    </LocalizationProvider>
  );
}
