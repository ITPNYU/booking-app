import React, { useEffect, useState } from 'react';

import { BookingProvider } from './bookingProvider';
import { Header } from './components/Header';
import { Outlet } from 'react-router-dom';
import { RoomSetting } from '../../../types';

export default function BookingForm() {
  const [selectedRoom, setSelectedRoom] = useState<RoomSetting[]>([]);

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
