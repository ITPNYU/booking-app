import { Bookings } from '../admin/components/Bookings';
import React from 'react';

export default function MyBookingsPage() {
  return <Bookings isUserView={true} showNnumber={false} />;
}
