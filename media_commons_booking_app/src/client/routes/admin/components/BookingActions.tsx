import React, { useContext, useMemo, useState } from 'react';

import { BookingStatusLabel } from '../../../../types';
import { DatabaseContext } from '../../components/Provider';
import Loading from '../../../utils/Loading';
import { serverFunctions } from '../../../utils/serverFunctions';
import { useLocation } from 'react-router';

interface Props {
  calendarEventId: string;
  status: BookingStatusLabel;
}

export default function BookingActions({ status, calendarEventId }: Props) {
  const [loading, setLoading] = useState(false);
  const { reloadBookings, reloadBookingStatuses } = useContext(DatabaseContext);

  const location = useLocation();
  const isAdminPage = useMemo(() => location.pathname === '/admin', [location]);

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
      }}
    >
      {text}
    </button>
  );

  if (loading) {
    return (
      <td className="px-2 py-4 w-28">
        <Loading />
      </td>
    );
  }

  const paBtns = (
    <>
      {status !== BookingStatusLabel.CHECKED_IN &&
        ActionButton('Check In', () =>
          serverFunctions.checkin(calendarEventId)
        )}
      {status !== BookingStatusLabel.NO_SHOW &&
        ActionButton('No Show', () => serverFunctions.noShow(calendarEventId))}
    </>
  );

  if (!isAdminPage) {
    return (
      <td className="px-2 py-4 w-28">
        <div className="flex flex-col items-start">{paBtns}</div>
      </td>
    );
  }

  return (
    <td className="px-2 py-4 w-36">
      <div className="flex flex-col items-start">
        {status === BookingStatusLabel.PRE_APPROVED &&
          ActionButton('2nd Approve', () =>
            serverFunctions.approveBooking(calendarEventId)
          )}
        {status === BookingStatusLabel.REQUESTED &&
          ActionButton('1st Approve', () =>
            serverFunctions.approveBooking(calendarEventId)
          )}
        {ActionButton('Reject', () => serverFunctions.reject(calendarEventId))}
        {ActionButton('Cancel', () => serverFunctions.cancel(calendarEventId))}
        {paBtns}
      </div>
    </td>
  );
}
