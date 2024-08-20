import { IconButton, MenuItem, Select } from "@mui/material";
import React, { useContext, useMemo, useState } from "react";
import {
  approveBooking,
  cancel,
  checkOut,
  checkin,
  noShow,
  reject,
} from "@/components/src/server/admin";

import AlertToast from "../../components/AlertToast";
import { BookingStatusLabel } from "../../../../types";
import Check from "@mui/icons-material/Check";
import ConfirmDialog from "../../components/ConfirmDialog";
import { DatabaseContext } from "../../components/Provider";
import Loading from "../../components/Loading";
import useExistingBooking from "../hooks/useExistingBooking";
import { useRouter } from "next/navigation";

interface Props {
  calendarEventId: string;
  isAdminView: boolean;
  isUserView: boolean;
  setOptimisticStatus: (x: BookingStatusLabel) => void;
  status: BookingStatusLabel;
}

enum Actions {
  CANCEL = "Cancel",
  NO_SHOW = "No Show",
  CHECK_IN = "Check In",
  CHECK_OUT = "Check Out",
  FIRST_APPROVE = "1st Approve",
  SECOND_APPROVE = "2nd Approve",
  REJECT = "Reject",
  EDIT = "Edit",
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
  isAdminView,
  isUserView,
  setOptimisticStatus,
}: Props) {
  const [uiLoading, setUiLoading] = useState(false);
  const [selectedAction, setSelectedAction] = useState<Actions>(
    Actions.PLACEHOLDER
  );
  const { reloadBookings, reloadBookingStatuses } = useContext(DatabaseContext);
  const [showError, setShowError] = useState(false);
  const router = useRouter();
  const loadExistingBookingData = useExistingBooking();

  const reload = async () => {
    await Promise.all([reloadBookings(), reloadBookingStatuses()]);
  };

  const onError = () => {
    setShowError(true);
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
        await approveBooking(calendarEventId);
      },
      optimisticNextStatus: BookingStatusLabel.PENDING,
    },
    [Actions.SECOND_APPROVE]: {
      action: async () => {
        await approveBooking(calendarEventId);
      },
      optimisticNextStatus: BookingStatusLabel.APPROVED,
    },
    [Actions.REJECT]: {
      action: async () => {
        await reject(calendarEventId);
      },
      optimisticNextStatus: BookingStatusLabel.REJECTED,
      confirmation: true,
    },
    [Actions.EDIT]: {
      action: async () => {
        loadExistingBookingData(calendarEventId);
        router.push("/edit/" + calendarEventId);
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
      status !== BookingStatusLabel.NO_SHOW
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
    } else if (status === BookingStatusLabel.CHECKED_IN) {
      options.push(Actions.NO_SHOW);
      options.push(Actions.CHECK_OUT);
    } else if (status === BookingStatusLabel.NO_SHOW) {
      options.push(Actions.CHECK_IN);
    }
    return options;
  }, [status]);

  const adminOptions = useMemo(() => {
    if (
      status === BookingStatusLabel.CANCELED ||
      status === BookingStatusLabel.REJECTED ||
      status === BookingStatusLabel.CHECKED_OUT
    ) {
      return [];
    }

    let options: Actions[] = [];
    if (status === BookingStatusLabel.REQUESTED) {
      options.push(Actions.FIRST_APPROVE);
    } else if (status === BookingStatusLabel.PENDING) {
      options.push(Actions.SECOND_APPROVE);
    }

    options = options.concat(paOptions);
    options.push(Actions.CANCEL);
    options.push(Actions.REJECT);
    return options;
  }, [status, paOptions]);

  const options = () => {
    if (isUserView) return userOptions;
    if (isAdminView) return adminOptions;
    return paOptions;
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
