import { BookingStatusLabel, PageContextLevel } from "../../../../types";
import { IconButton, MenuItem, Select } from "@mui/material";
import React, { useContext, useMemo, useState } from "react";
import {
  cancel,
  checkOut,
  checkin,
  clientApproveBooking,
  decline,
  noShow,
} from "@/components/src/server/db";

import AlertToast from "../../components/AlertToast";
import { BookingContext } from "../../booking/bookingProvider";
import Check from "@mui/icons-material/Check";
import ConfirmDialog from "../../components/ConfirmDialog";
import { DatabaseContext } from "../../components/Provider";
import Loading from "../../components/Loading";
import { Timestamp } from "@firebase/firestore";
import useExistingBooking from "../hooks/useExistingBooking";
import { useRouter } from "next/navigation";

interface Props {
  calendarEventId: string;
  pageContext: PageContextLevel;
  setOptimisticStatus: (x: BookingStatusLabel) => void;
  status: BookingStatusLabel;
  startDate: Timestamp;
}

enum Actions {
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

type ActionDefinition = {
  // TODO: Fix this type
  action: () => any;
  optimisticNextStatus: BookingStatusLabel;
  confirmation?: boolean;
};

export default function BookingActions({
  status,
  calendarEventId,
  pageContext,
  setOptimisticStatus,
  startDate,
}: Props) {
  const [uiLoading, setUiLoading] = useState(false);
  const [selectedAction, setSelectedAction] = useState<Actions>(
    Actions.PLACEHOLDER
  );
  const { reloadBookings, reloadBookingStatuses } = useContext(DatabaseContext);
  const { reloadExistingCalendarEvents } = useContext(BookingContext);
  const [showError, setShowError] = useState(false);
  const [date, setDate] = useState(new Date());
  const router = useRouter();
  const loadExistingBookingData = useExistingBooking();

  const reload = async () => {
    await Promise.all([reloadBookings(), reloadBookingStatuses()]);
  };

  const onError = () => {
    setShowError(true);
  };

  const updateActions = () => {
    setDate(new Date());
  };

  const handleDialogChoice = (result: boolean) => {
    if (result) {
      const actionDetails = actions[selectedAction];
      doAction(actionDetails);
    }
  };

  const doAction = async ({
    action,
    optimisticNextStatus,
  }: ActionDefinition) => {
    setUiLoading(true);
    setOptimisticStatus(optimisticNextStatus);

    try {
      await action();
    } catch (ex) {
      console.error(ex);
      setOptimisticStatus(undefined);
      onError();
    } finally {
      await reload();
      setOptimisticStatus(undefined);
      setSelectedAction(Actions.PLACEHOLDER);
      setUiLoading(false);
    }
  };

  const actions: { [key in Actions]: ActionDefinition } = {
    [Actions.CANCEL]: {
      action: async () => {
        await cancel(calendarEventId);
      },
      optimisticNextStatus: BookingStatusLabel.CANCELED,
      confirmation: true,
    },
    [Actions.NO_SHOW]: {
      action: async () => {
        await noShow(calendarEventId);
      },
      optimisticNextStatus: BookingStatusLabel.NO_SHOW,
    },
    [Actions.CHECK_IN]: {
      action: async () => {
        await checkin(calendarEventId);
      },
      optimisticNextStatus: BookingStatusLabel.CHECKED_IN,
    },
    [Actions.CHECK_OUT]: {
      action: async () => {
        await checkOut(calendarEventId);
      },
      optimisticNextStatus: BookingStatusLabel.CHECKED_OUT,
    },
    [Actions.FIRST_APPROVE]: {
      action: async () => {
        await clientApproveBooking(calendarEventId);
      },
      optimisticNextStatus: BookingStatusLabel.PENDING,
    },
    [Actions.FINAL_APPROVE]: {
      action: async () => {
        await clientApproveBooking(calendarEventId);
      },
      optimisticNextStatus: BookingStatusLabel.APPROVED,
    },
    [Actions.DECLINE]: {
      action: async () => {
        await decline(calendarEventId);
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
      options.push(Actions.NO_SHOW);
      options.push(Actions.MODIFICATION);
    } else if (status === BookingStatusLabel.CHECKED_IN) {
      options.push(Actions.NO_SHOW);
      options.push(Actions.CHECK_OUT);
      options.push(Actions.MODIFICATION);
    } else if (status === BookingStatusLabel.NO_SHOW) {
      options.push(Actions.CHECK_IN);
    } else if (status === BookingStatusLabel.WALK_IN) {
      options.push(Actions.CHECK_OUT);
      options.push(Actions.MODIFICATION);
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

  if (options().length === 0) {
    return <></>;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "center",
      }}
    >
      <Select
        value={selectedAction}
        size="small"
        displayEmpty
        onFocus={updateActions}
        onChange={(e) => setSelectedAction(e.target.value as Actions)}
        renderValue={(selected) => {
          if (selected === Actions.PLACEHOLDER) {
            return <em style={{ color: "gray" }}>Action</em>;
          }
          return selected;
        }}
        sx={{
          width: 125,
        }}
      >
        <MenuItem value={Actions.PLACEHOLDER} sx={{ color: "gray" }}>
          <em>Action</em>
        </MenuItem>
        {options().map((action) => (
          <MenuItem value={action} key={action}>
            {action}
          </MenuItem>
        ))}
      </Select>
      {uiLoading ? (
        <Loading style={{ height: "24px", width: "24px", margin: 8 }} />
      ) : actions[selectedAction].confirmation === true ? (
        <ConfirmDialog
          message="Are you sure? This action can't be undone."
          callback={handleDialogChoice}
        >
          <IconButton
            disabled={selectedAction === Actions.PLACEHOLDER}
            color={"primary"}
          >
            <Check />
          </IconButton>
        </ConfirmDialog>
      ) : (
        <IconButton
          disabled={selectedAction === Actions.PLACEHOLDER}
          color={"primary"}
          onClick={() => {
            handleDialogChoice(true);
          }}
        >
          <Check />
        </IconButton>
      )}
      <AlertToast
        message="Failed to perform action on booking"
        severity="error"
        open={showError}
        handleClose={() => setShowError(false)}
      />
    </div>
  );
}
