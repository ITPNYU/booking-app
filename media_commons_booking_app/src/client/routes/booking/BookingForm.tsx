import React, { useEffect } from 'react';

import { BookingProvider } from './bookingProvider';
import { Header } from './components/Header';
import { Outlet } from 'react-router-dom';

export default function BookingForm() {
  useEffect(() => {
    console.log('DEPLOY MODE ENVIRONMENT:', process.env.CALENDAR_ENV);
  }, []);

  return (
    <BookingProvider>
      <Header />
      <Outlet />
    </BookingProvider>
  );
}
