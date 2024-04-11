import React, { useContext, useMemo, useState } from 'react';

import { BookingStatusLabel } from '../../../../types';
import { DatabaseContext } from '../../components/Provider';
import Loading from '../../../utils/Loading';
import { serverFunctions } from '../../../utils/serverFunctions';
import { useLocation } from 'react-router';

interface Props {
  calendarEventId: string;
  setOptimisticStatus: (x: BookingStatusLabel) => void;
  status: BookingStatusLabel;
}

export default function BookingActions({
  status,
  calendarEventId,
  setOptimisticStatus,
}: Props) {
  const [uiLoading, setUiLoading] = useState(false);
  const { reloadBookings, reloadBookingStatuses } = useContext(DatabaseContext);

  const location = useLocation();
  const isAdminPage = useMemo(() => location.pathname === '/admin', [location]);

  const reload = async () => {
    await Promise.all([reloadBookings(), reloadBookingStatuses()]);
  };

  const onError = () => alert();

  const ActionButton = (
    text: string,
    action: () => Promise<void>,
    optimisticNextStatus: BookingStatusLabel
  ) => (
    <button
      className="font-medium text-blue-600 dark:text-blue-500 hover:underline mr-2"
      onClick={async () => {
        setUiLoading(true);
        setOptimisticStatus(optimisticNextStatus);
        try {
          action()
            .catch(() => {
              onError();
              setOptimisticStatus(undefined);
            })
            .finally(reload);
        } catch (ex) {
          console.error(ex);
          alert('Failed to perform action on booking');
        } finally {
          setUiLoading(false);
        }
      }}
    >
      {text}
    </button>
  );

  if (uiLoading) {
    return (
      <td className="px-2 py-4 w-28">
        <Loading />
      </td>
    );
  }

  const paBtns = () => {
    const checkInBtn = ActionButton(
      'Check In',
      () => serverFunctions.checkin(calendarEventId),
      BookingStatusLabel.CHECKED_IN
    );
    const noShowBtn = ActionButton(
      'No Show',
      () => serverFunctions.noShow(calendarEventId),
      BookingStatusLabel.NO_SHOW
    );

    if (status === BookingStatusLabel.APPROVED) {
      return (
        <>
          {checkInBtn}
          {noShowBtn}
        </>
      );
    } else if (status === BookingStatusLabel.CHECKED_IN) {
      return noShowBtn;
    } else if (status === BookingStatusLabel.NO_SHOW) {
      return checkInBtn;
    }
  };

  if (!isAdminPage) {
    return (
      <td className="px-2 py-4 w-28">
        <div className="flex flex-col items-start">{paBtns()}</div>
      </td>
    );
  }

  if (
    status === BookingStatusLabel.CANCELED ||
    status === BookingStatusLabel.REJECTED
  ) {
    return <p></p>;
  }

  return (
    <td className="px-2 py-4 w-40">
      <div className="flex flex-col items-start">
        {status === BookingStatusLabel.PRE_APPROVED &&
          ActionButton(
            '2nd Approve',
            () => serverFunctions.approveBooking(calendarEventId),
            BookingStatusLabel.APPROVED
          )}
        {status === BookingStatusLabel.REQUESTED &&
          ActionButton(
            '1st Approve',
            () => serverFunctions.approveBooking(calendarEventId),
            BookingStatusLabel.PRE_APPROVED
          )}
        {ActionButton(
          'Reject',
          () => serverFunctions.reject(calendarEventId),
          BookingStatusLabel.REJECTED
        )}
        {ActionButton(
          'Cancel',
          () => serverFunctions.cancel(calendarEventId),
          BookingStatusLabel.CANCELED
        )}
        {paBtns()}
      </div>
    </td>
  );
}
