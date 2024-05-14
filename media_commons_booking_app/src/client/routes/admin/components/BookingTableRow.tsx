import { Booking, BookingStatusLabel } from '../../../../types';
import React, { useContext, useState } from 'react';

import BookingActions from './BookingActions';
import { DatabaseContext } from '../../components/Provider';
import { formatDate } from '../../../utils/date';
import getBookingStatus from '../hooks/getBookingStatus';

interface Props {
  booking: Booking;
  isAdminView: boolean;
  isUserView: boolean;
}

export default function BookingTableRow({
  booking,
  isAdminView,
  isUserView,
}: Props) {
  const { bookingStatuses } = useContext(DatabaseContext);
  const status = getBookingStatus(booking, bookingStatuses);

  const [optimisticStatus, setOptimisticStatus] =
    useState<BookingStatusLabel>();

  return (
    <tr className="">
      <BookingActions
        status={optimisticStatus ?? status}
        calendarEventId={booking.calendarEventId}
        {...{ setOptimisticStatus, isAdminView, isUserView }}
      />
      <td className="px-2 py-4 w-28">{optimisticStatus ?? status}</td>
      <td className="px-2 py-4 w-36">{booking.roomId}</td>
      <td scope="row" className="px-2 py-4 w-40 text-gray-900 dark:text-white">
        <div className="pl-3 w-full">
          <div className="flex flex-col">
            <div className="text-base font-semibold">
              {booking.firstName} {booking.lastName}
            </div>
            <div className="font-normal text-gray-500">{booking.email}</div>
            <div className="font-normal text-gray-500">
              {booking.phoneNumber}
            </div>
          </div>
        </div>
      </td>
      <td className="px-2 py-4 w-40">
        <div className=" flex items-center flex-col">
          <div>{formatDate(booking.startDate)}</div>
        </div>
      </td>
      <td className="px-2 py-4 w-40">
        <div className=" flex items-center flex-col">
          <div>{formatDate(booking.endDate)}</div>
        </div>
      </td>
      <td className="px-2 py-4 w-36">{booking.secondaryName}</td>
      {isAdminView && <td className="px-2 py-4 w-20">{booking.nNumber}</td>}
      <td className="px-2 py-4 w-20">{booking.netId}</td>
      <td className="px-2 py-4 w-36">{booking.department}</td>
      <td className="px-2 py-4 w-20">{booking.role}</td>
      <td className="px-2 py-4 w-24">
        {booking.sponsorFirstName} {booking.sponsorLastName}
      </td>
      <td className="px-2 py-4 w-20">{booking.sponsorEmail}</td>
      <td className="px-2 py-4 w-52 break-all">{booking.title}</td>
      <td className="px-2 py-4 w-60 break-all">{booking.description}</td>
      <td className="px-2 py-4 w-60 break-all">{booking.reservationType}</td>
      <td className="px-2 py-4 w-20">{booking.expectedAttendance}</td>
      <td className="px-2 py-4 w-20">{booking.attendeeAffiliation}</td>
      <td className="px-2 py-4 w-40">
        {booking.roomSetup}
        {booking.setupDetails && (
          <>
            <br />
            <b>Details</b>
            <br />
            {booking.setupDetails}
          </>
        )}
      </td>
      <td className="px-2 py-4 w-24">{booking.chartFieldForRoomSetup}</td>
      <td className="px-2 py-4 w-40">
        {booking.mediaServices}
        {booking.mediaServicesDetails && (
          <>
            <br />
            <b>Details</b>
            <br />
            {booking.mediaServicesDetails}
          </>
        )}
      </td>
      <td className="px-2 py-4 w-18">{booking.catering}</td>
      <td className="px-2 py-4 w-18">{booking.cateringService}</td>
      <td className="px-2 py-4 w-24">{booking.chartFieldForCatering}</td>
      <td className="px-2 py-4 w-18">{booking.hireSecurity}</td>
      <td className="px-2 py-4 w-24">{booking.chartFieldForSecurity}</td>
    </tr>
  );
}
