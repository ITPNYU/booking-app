import { BookingStatusLabel, PageContextLevel } from "@/components/src/types";
import {
  cancel,
  checkOut,
  checkin,
  clientApproveBooking,
  decline,
  noShow,
} from "@/components/src/server/db";
import { useContext, useMemo, useState } from "react";

import { BookingContext } from "../../booking/bookingProvider";
import { DatabaseContext } from "../../components/Provider";
import { Timestamp } from "@firebase/firestore";
import useExistingBooking from "./useExistingBooking";
import { useRouter } from "next/navigation";

export enum Actions {
  CANCEL = "Cancel",
  NO_SHOW = "No Show",
  CHECK_IN = "Check In",
  CHECK_OUT = "Check Out",
  FIRST_APPROVE = "1st Approve",
  FINAL_APPROVE = "Final Approve",
  DECLINE = "Decline",
  EDIT = "Edit",
  MODIFICATION = "Modification",
  PLACEHOLDER = "",
}

export type ActionDefinition = {
  // TODO: Fix this type
  action: () => any;
  optimisticNextStatus: BookingStatusLabel;
  confirmation?: boolean;
};

interface Props {
  calendarEventId: string;
  pageContext: PageContextLevel;
  status: BookingStatusLabel;
  startDate: Timestamp;
  reason: string;
}

export default function useBookingActions({
  calendarEventId,
  pageContext,
  status,
  startDate,
  reason,
}: Props) {
  const [date, setDate] = useState(new Date());

  const { reloadExistingCalendarEvents } = useContext(BookingContext);
  const { userEmail } = useContext(DatabaseContext);
  const loadExistingBookingData = useExistingBooking();
  const router = useRouter();

  const updateActions = () => {
    setDate(new Date());
  };

  const actions: { [key in Actions]: ActionDefinition } = {
    [Actions.CANCEL]: {
      action: async () => {
        await cancel(calendarEventId, userEmail);
      },
      optimisticNextStatus: BookingStatusLabel.CANCELED,
      confirmation: true,
    },
    [Actions.NO_SHOW]: {
      action: async () => {
        await noShow(calendarEventId, userEmail);
      },
      optimisticNextStatus: BookingStatusLabel.NO_SHOW,
    },
    [Actions.CHECK_IN]: {
      action: async () => {
        await checkin(calendarEventId, userEmail);
      },
      optimisticNextStatus: BookingStatusLabel.CHECKED_IN,
    },
    [Actions.CHECK_OUT]: {
      action: async () => {
        await checkOut(calendarEventId, userEmail);
      },
      optimisticNextStatus: BookingStatusLabel.CHECKED_OUT,
    },
    [Actions.FIRST_APPROVE]: {
      action: async () => {
        await clientApproveBooking(calendarEventId, userEmail);
      },
      optimisticNextStatus: BookingStatusLabel.PENDING,
    },
    [Actions.FINAL_APPROVE]: {
      action: async () => {
        await clientApproveBooking(calendarEventId, userEmail);
      },
      optimisticNextStatus: BookingStatusLabel.APPROVED,
    },
    [Actions.DECLINE]: {
      action: async () => {
        await decline(calendarEventId, userEmail, reason);
      },
      optimisticNextStatus: BookingStatusLabel.DECLINED,
      confirmation: true,
    },
    [Actions.EDIT]: {
      action: async () => {
        loadExistingBookingData(calendarEventId);
        reloadExistingCalendarEvents();
        router.push("/edit/" + calendarEventId);
      },
      optimisticNextStatus: status,
      confirmation: false,
    },
    [Actions.MODIFICATION]: {
      action: async () => {
        loadExistingBookingData(calendarEventId);
        reloadExistingCalendarEvents();
        router.push("/modification/" + calendarEventId);
      },
      optimisticNextStatus: status,
      confirmation: false,
    },
    // never used, just make typescript happy
    [Actions.PLACEHOLDER]: {
      action: async () => {},
      optimisticNextStatus: BookingStatusLabel.UNKNOWN,
    },
  };

  const userOptions = useMemo(() => {
    let options = [];
    if (status !== BookingStatusLabel.CANCELED) {
      options.push(Actions.CANCEL);
    }
    if (
      status !== BookingStatusLabel.CHECKED_IN &&
      status !== BookingStatusLabel.NO_SHOW &&
      startDate.toDate() > date
    ) {
      options.push(Actions.EDIT);
    }
    return options;
  }, [status]);

  const paOptions = useMemo(() => {
    let options = [];

    if (status === BookingStatusLabel.APPROVED) {
      options.push(Actions.CHECK_IN);
      options.push(Actions.MODIFICATION);
    } else if (status === BookingStatusLabel.CHECKED_IN) {
      options.push(Actions.CHECK_OUT);
      options.push(Actions.MODIFICATION);
    } else if (status === BookingStatusLabel.NO_SHOW) {
      options.push(Actions.CHECK_IN);
    } else if (status === BookingStatusLabel.WALK_IN) {
      options.push(Actions.CHECK_OUT);
      options.push(Actions.MODIFICATION);
    }

    const THIRTY_MIN_MS = 30 * 60 * 1000;
    const thirtyPastStartTime =
      date.getTime() - startDate.toDate().getTime() >= THIRTY_MIN_MS;
    if (
      thirtyPastStartTime &&
      (status === BookingStatusLabel.APPROVED ||
        status === BookingStatusLabel.CHECKED_IN)
    ) {
      options.push(Actions.NO_SHOW);
    }

    return options;
  }, [status]);

  const liaisonOptions = [Actions.FIRST_APPROVE, Actions.DECLINE];

  const adminOptions = useMemo(() => {
    if (
      status === BookingStatusLabel.CANCELED ||
      status === BookingStatusLabel.DECLINED ||
      status === BookingStatusLabel.CHECKED_OUT
    ) {
      return [];
    }

    let options: Actions[] = [];
    if (status === BookingStatusLabel.REQUESTED) {
      options.push(Actions.FIRST_APPROVE);
    } else if (status === BookingStatusLabel.PENDING) {
      options.push(Actions.FINAL_APPROVE);
    }

    options = options.concat(paOptions);
    options.push(Actions.CANCEL);
    options.push(Actions.DECLINE);
    return options;
  }, [status, paOptions, date]);

  const options = () => {
    switch (pageContext) {
      case PageContextLevel.USER:
        return userOptions;
      case PageContextLevel.PA:
        return paOptions;
      case PageContextLevel.LIAISON:
        return liaisonOptions;
      default:
        return adminOptions;
    }
  };

  return { actions, updateActions, options };
}
