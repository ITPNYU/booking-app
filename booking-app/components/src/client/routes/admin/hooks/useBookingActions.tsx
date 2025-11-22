import {
  cancel,
  checkOut,
  checkin,
  clientApproveBooking,
  clientEquipmentApprove,
  clientSendToEquipment,
  decline,
  noShow,
} from "@/components/src/server/db";
import { BookingStatusLabel, PageContextLevel } from "@/components/src/types";
import { useContext, useMemo, useState } from "react";

import { Timestamp } from "@firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { BookingContext } from "../../booking/bookingProvider";
import { DatabaseContext } from "../../components/Provider";
import useExistingBooking from "./useExistingBooking";

export enum Actions {
  CANCEL = "Cancel",
  NO_SHOW = "No Show",
  CHECK_IN = "Check In",
  CHECK_OUT = "Check Out",
  FIRST_APPROVE = "1st Approve",
  FINAL_APPROVE = "Final Approve",
  EQUIPMENT_APPROVE = "Equipment Approve",
  SEND_TO_EQUIPMENT = "Send to Equipment",
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
  const router = useRouter();
  const { tenant } = useParams();
  const { reloadExistingCalendarEvents } = useContext(BookingContext);
  const { userEmail, netId } = useContext(DatabaseContext);
  const loadExistingBookingData = useExistingBooking();

  const updateActions = () => {
    setDate(new Date());
  };

  const actions: { [key in Actions]: ActionDefinition } = {
    [Actions.CANCEL]: {
      action: async () => {
        await cancel(calendarEventId, userEmail, netId);
      },
      optimisticNextStatus: BookingStatusLabel.CANCELED,
      confirmation: true,
    },
    [Actions.NO_SHOW]: {
      action: async () => {
        await noShow(calendarEventId, userEmail, netId);
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
    [Actions.EQUIPMENT_APPROVE]: {
      action: async () => {
        await clientEquipmentApprove(calendarEventId, userEmail);
      },
      optimisticNextStatus: BookingStatusLabel.APPROVED,
    },
    [Actions.SEND_TO_EQUIPMENT]: {
      action: async () => {
        await clientSendToEquipment(calendarEventId, userEmail);
      },
      optimisticNextStatus: BookingStatusLabel.EQUIPMENT,
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
        router.push(`/${tenant}/edit/${calendarEventId}`);
      },
      optimisticNextStatus: status,
      confirmation: false,
    },
    [Actions.MODIFICATION]: {
      action: async () => {
        loadExistingBookingData(calendarEventId);
        reloadExistingCalendarEvents();
        router.push(`/${tenant}/modification/${calendarEventId}`);
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
    if (
      status !== BookingStatusLabel.CANCELED &&
      status !== BookingStatusLabel.CHECKED_IN &&
      status !== BookingStatusLabel.CHECKED_OUT &&
      status !== BookingStatusLabel.NO_SHOW
    ) {
      options.push(Actions.CANCEL);
    }
    if (status == BookingStatusLabel.REQUESTED && startDate.toDate() > date) {
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
  const equipmentOptions = [
    Actions.MODIFICATION,
    Actions.EQUIPMENT_APPROVE,
    Actions.DECLINE,
  ];

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
      // No SEND_TO_EQUIPMENT for REQUESTED status
    } else if (status === BookingStatusLabel.PENDING) {
      options.push(Actions.FINAL_APPROVE);
      options.push(Actions.SEND_TO_EQUIPMENT); // Only show for PENDING status
    } else if (status === BookingStatusLabel.EQUIPMENT) {
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
      case PageContextLevel.EQUIPMENT:
        return equipmentOptions;
      default:
        return adminOptions;
    }
  };

  return { actions, updateActions, options };
}
