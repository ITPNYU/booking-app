import { DateCalendar, LocalizationProvider } from '@mui/x-date-pickers';
import React, { useContext, useEffect, useState } from 'react';
import dayjs, { Dayjs } from 'dayjs';

import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { BookingContext } from '../bookingProvider';

export const CalendarDatePicker = ({ handleChange }) => {
  const [date, setDate] = useState<Dayjs | null>(dayjs(new Date()));
  const { bookingCalendarInfo } = useContext(BookingContext);

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

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <DateCalendar
        value={date}
        onChange={handleDateChange}
        views={['day', 'month']}
        autoFocus
        disablePast
        showDaysOutsideCurrentMonth
      />
    </LocalizationProvider>
  );
};
