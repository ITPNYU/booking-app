import { Booking, BookingStatusLabel } from '../../../../types';
import React, { useContext, useMemo, useState } from 'react';

import { DatabaseContext } from '../../components/Provider';
import Loading from '../../../utils/Loading';
import { serverFunctions } from '../../../utils/serverFunctions';
import useBookingStatus from '../hooks/getBookingStatus';

interface Props {
  calendarEventId: string;
  status: BookingStatusLabel;
}

export default function BookingActions({ status, calendarEventId }: Props) {
  const [loading, setLoading] = useState(false);
  const { reloadBookings, reloadBookingStatuses } = useContext(DatabaseContext);

  const reload = async () => {
    await Promise.all([reloadBookings(), reloadBookingStatuses()]);
  };

  const ActionButton = (text: string, action: () => Promise<void>) => (
    <button
      className="font-medium text-blue-600 dark:text-blue-500 hover:underline mr-2"
      onClick={async () => {
        setLoading(true);
        try {
          await action();
          await reload();
        } catch (ex) {
          console.error(ex);
          alert('Failed to perform action on booking');
        } finally {
          setLoading(false);
        }
        // await action();
        // await reload();
        // setLoading(false);
      }}
    >
      {text}
    </button>
  );

  if (loading) {
    return <Loading />;
  }

  return (
    <>
      {status === BookingStatusLabel.PRE_APPROVED &&
        ActionButton('Second Approve', () =>
          serverFunctions.approveBooking(calendarEventId)
        )}
      {status === BookingStatusLabel.REQUESTED &&
        ActionButton('First Approve', () =>
          serverFunctions.approveBooking(calendarEventId)
        )}
      {ActionButton('Reject', () => serverFunctions.reject(calendarEventId))}
      {ActionButton('Cancel', () => serverFunctions.cancel(calendarEventId))}
      {status !== BookingStatusLabel.CHECKED_IN &&
        ActionButton('Check In', () =>
          serverFunctions.checkin(calendarEventId)
        )}
    </>
  );
}
