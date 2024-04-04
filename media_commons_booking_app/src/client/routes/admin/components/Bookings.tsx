import React, { useContext, useMemo } from 'react';

import BookingActions from './BookingActions';
import { DatabaseContext } from '../../components/Provider';
import { formatDate } from '../../../utils/date';
import getBookingStatus from '../hooks/getBookingStatus';

interface BookingsProps {
  showNnumber: boolean;
  isUserView?: boolean;
}

const TableHeader = (text: string) => (
  <th scope="col" className="px-2 py-3 align-bottom">
    {text}
  </th>
);

export const Bookings: React.FC<BookingsProps> = ({
  showNnumber = false,
  isUserView = false,
}) => {
  const { bookings, bookingStatuses, userEmail } = useContext(DatabaseContext);

  const filteredBookings = useMemo(() => {
    if (isUserView)
      return bookings.filter((booking) => booking.email === userEmail);
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
              {showNnumber && TableHeader('N Number')}
              {TableHeader('Net ID')}
              {/* {TableHeader('Phone Number')} */}
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
            {filteredBookings.map((booking, index) => {
              const status = getBookingStatus(booking, bookingStatuses);
              return (
                <tr key={index} className="">
                  {!isUserView && (
                    <BookingActions
                      status={status}
                      calendarEventId={booking.calendarId}
                    />
                  )}
                  <td className="px-2 py-4 w-24">{status}</td>
                  <td className="px-2 py-4 w-36">{booking.roomId}</td>
                  <td
                    scope="row"
                    className="px-2 py-4 w-40 text-gray-900 dark:text-white"
                  >
                    <div className="pl-3 w-full">
                      <div className="flex flex-col">
                        <div className="text-base font-semibold">
                          {booking.firstName} {booking.lastName}
                        </div>
                        <div className="font-normal text-gray-500">
                          {booking.email}
                        </div>
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
                  {showNnumber && (
                    <td className="px-2 py-4 w-20">{booking.nNumber}</td>
                  )}
                  <td className="px-2 py-4 w-20">{booking.netId}</td>
                  {/* <td className="px-2 py-4 w-20">{booking.phoneNumber}</td> */}
                  <td className="px-2 py-4 w-36">{booking.department}</td>
                  <td className="px-2 py-4 w-20">{booking.role}</td>
                  <td className="px-2 py-4 w-24">
                    {booking.sponsorFirstName} {booking.sponsorLastName}
                  </td>
                  <td className="px-2 py-4 w-20">{booking.sponsorEmail}</td>
                  <td className="px-2 py-4 w-52 break-all">{booking.title}</td>
                  <td className="px-2 py-4 w-60 break-all">
                    {booking.description}
                  </td>
                  <td className="px-2 py-4 w-20">
                    {booking.expectedAttendance}
                  </td>
                  <td className="px-2 py-4 w-20">
                    {booking.attendeeAffiliation}
                  </td>
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
                  <td className="px-2 py-4 w-24">
                    {booking.chartFieldForRoomSetup}
                  </td>
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
                  <td className="px-2 py-4 w-24">
                    {booking.chartFieldForCatering}
                  </td>
                  <td className="px-2 py-4 w-18">{booking.hireSecurity}</td>
                  <td className="px-2 py-4 w-24">
                    {booking.chartFieldForSecurity}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
