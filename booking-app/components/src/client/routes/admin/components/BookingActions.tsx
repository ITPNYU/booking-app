import React, { useContext, useState } from "react";

import { BookingStatusLabel } from "../../../../types";
import { DatabaseContext } from "../../components/Provider";
import Loading from "../../../utils/Loading";
import {
  approveBooking,
  cancel,
  checkin,
  noShow,
  reject,
} from "@/components/src/server/admin";

interface Props {
  calendarEventId: string;
  isAdminView: boolean;
  isUserView: boolean;
  setOptimisticStatus: (x: BookingStatusLabel) => void;
  status: BookingStatusLabel;
}

export default function BookingActions({
  status,
  calendarEventId,
  isAdminView,
  isUserView,
  setOptimisticStatus,
}: Props) {
  const [uiLoading, setUiLoading] = useState(false);
  const { reloadBookings, reloadBookingStatuses } = useContext(DatabaseContext);

  const reload = async () => {
    await Promise.all([reloadBookings(), reloadBookingStatuses()]);
  };

  const onError = () => alert("Failed to perform action on booking");

  const ActionButton = (
    text: string,
    action: () => Promise<void>,
    optimisticNextStatus: BookingStatusLabel,
    confirmation?: boolean
  ) => (
    <button
      className="font-medium text-blue-600 dark:text-blue-500 hover:underline mr-2"
      onClick={async () => {
        if (confirmation) {
          const result = confirm(`Are you sure? This action can't be undone.`);
          if (!result) {
            return;
          }
        }
        setUiLoading(true);
        setOptimisticStatus(optimisticNextStatus);
        try {
          action()
            .catch(() => {
              onError();
              setOptimisticStatus(BookingStatusLabel.UNKNOWN);
            })
            .finally(() =>
              reload().then(() =>
                setOptimisticStatus(BookingStatusLabel.UNKNOWN)
              )
            );
        } catch (ex) {
          console.error(ex);
          onError();
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

  if (isUserView) {
    if (status === BookingStatusLabel.CANCELED) {
      return <td />;
    }
    return (
      <td className="px-2 py-4 w-28">
        <div className="flex flex-col items-start">
          {ActionButton(
            "Cancel",
            async () => {
              await cancel(calendarEventId);
            },
            BookingStatusLabel.CANCELED,
            true
          )}
        </div>
      </td>
    );
  }

  const paBtns = () => {
    const checkInBtn = ActionButton(
      "Check In",
      async () => {
        await checkin(calendarEventId);
      },
      BookingStatusLabel.CHECKED_IN
    );
    const noShowBtn = ActionButton(
      "No Show",
      async () => {
        await noShow(calendarEventId);
      },
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

  if (
    status === BookingStatusLabel.CANCELED ||
    status === BookingStatusLabel.DECLINED
  ) {
    return <td />;
  }

  return (
    <td className="px-2 py-4 w-40">
      <div className="flex flex-col items-start">
        {status === BookingStatusLabel.PRE_APPROVED &&
          ActionButton(
            "2nd Approve",
            async () => {
              await approveBooking(calendarEventId);
            },
            BookingStatusLabel.APPROVED
          )}
        {status === BookingStatusLabel.REQUESTED &&
          ActionButton(
            "1st Approve",
            async () => {
              await approveBooking(calendarEventId);
            },
            BookingStatusLabel.PRE_APPROVED
          )}
        {ActionButton(
          "Reject",
          async () => {
            await reject(calendarEventId);
          },
          BookingStatusLabel.DECLINED,
          true
        )}
        {paBtns()}
      </div>
    </td>
  );
}
