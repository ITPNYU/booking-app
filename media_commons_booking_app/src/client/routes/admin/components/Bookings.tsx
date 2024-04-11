import React, { useContext, useMemo } from 'react';

import { BookingStatusLabel } from '../../../../types';
import BookingTableRow from './BookingTableRow';
import { DatabaseContext } from '../../components/Provider';
import getBookingStatus from '../hooks/getBookingStatus';

interface BookingsProps {
  isAdminView?: boolean;
  isPaView?: boolean;
  isUserView?: boolean;
}

const TableHeader = (text: string) => (
  <th scope="col" className="px-2 py-3 align-bottom">
    {text}
  </th>
);

export const Bookings: React.FC<BookingsProps> = ({
  isAdminView = false,
  isPaView = false,
  isUserView = false,
}) => {
  const { bookings, bookingStatuses, userEmail } = useContext(DatabaseContext);

  const filteredBookings = useMemo(() => {
    const paViewStatuses = [
      BookingStatusLabel.APPROVED,
      BookingStatusLabel.CHECKED_IN,
      BookingStatusLabel.NO_SHOW,
    ];
    if (isUserView)
      return bookings.filter((booking) => booking.email === userEmail);
    if (isPaView)
      return bookings.filter((booking) =>
        paViewStatuses.includes(getBookingStatus(booking, bookingStatuses))
      );
    return bookings;
  }, [isUserView, bookings]);

  return (
    <div className="m-10">
      <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
        <table className="w-[2500px] text-sm text-left text-gray-500 dark:text-gray-400">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              {!isUserView && TableHeader('Action')}
              {TableHeader('Status')}
              {TableHeader('Room ID')}
              {TableHeader('Contact')}
              {TableHeader('Booking Start')}
              {TableHeader('Booking End')}
              {TableHeader('Secondary Name')}
              {isAdminView && TableHeader('N Number')}
              {TableHeader('Net ID')}
              {TableHeader('Department')}
              {TableHeader('Role')}
              {TableHeader('Sponsor Name')}
              {TableHeader('Sponsor Email')}
              {TableHeader('Title')}
              {TableHeader('Description')}
              {TableHeader('Expected Attendees')}
              {TableHeader('Attendee Affiliation')}
              {TableHeader('Setup')}
              {TableHeader('Chartfield Info for Room Setup')}
              {TableHeader('Media Service')}
              {TableHeader('Catering')}
              {TableHeader('Catering Service')}
              {TableHeader('Chartfield Info for Catering')}
              {TableHeader('Security')}
              {TableHeader('Chartfield Info for Security')}
            </tr>
          </thead>
          <tbody>
            {filteredBookings.map((booking, index) => (
              <BookingTableRow
                key={index}
                {...{ booking, isAdminView, isUserView }}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
