import { IconButton, MenuItem, Select } from "@mui/material";
import { useContext, useMemo, useState } from "react";
import { BookingStatusLabel, PageContextLevel } from "../../../../types";
import useBookingActions, {
  ActionDefinition,
  Actions,
} from "../hooks/useBookingActions";

import Check from "@mui/icons-material/Check";
import { Timestamp } from "firebase/firestore";
import AlertToast from "../../components/AlertToast";
import ConfirmDialog from "../../components/ConfirmDialog";
import DeclineReasonDialog from "../../components/DeclineReasonDialog";
import Loading from "../../components/Loading";
import { DatabaseContext } from "../../components/Provider";
import getBookingStatus from "../../hooks/getBookingStatus";

interface Props {
  calendarEventId: string;
  onSelect: () => void;
  pageContext: PageContextLevel;
  setOptimisticStatus: (x: BookingStatusLabel) => void;
  status: BookingStatusLabel;
  startDate: Timestamp;
}

export default function BookingActions(props: Props) {
  const {
    status,
    calendarEventId,
    onSelect,
    pageContext,
    setOptimisticStatus,
    startDate,
  } = props;
  const [uiLoading, setUiLoading] = useState(false);
  const [selectedAction, setSelectedAction] = useState<Actions>(
    Actions.PLACEHOLDER
  );
  const { reloadFutureBookings, allBookings } = useContext(DatabaseContext);
  const [showError, setShowError] = useState(false);
  const [reason, setReason] = useState<string>();

  const { actions, updateActions, options } = useBookingActions({
    status,
    calendarEventId,
    pageContext,
    startDate,
    reason,
  });

  const onFocus = () => {
    updateActions();
    onSelect();
  };

  const reload = async () => {
    reloadFutureBookings();
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
      await reload();
    } catch (ex) {
      console.error(ex);
      setOptimisticStatus(undefined);
      onError();
    } finally {
      setSelectedAction(Actions.PLACEHOLDER);
      setUiLoading(false);
    }
  };

  const onAction = useMemo(() => {
    if (selectedAction === Actions.DECLINE) {
      return (
        <DeclineReasonDialog
          callback={handleDialogChoice}
          value={reason}
          setValue={setReason}
        >
          <IconButton color={"primary"}>
            <Check />
          </IconButton>
        </DeclineReasonDialog>
      );
    }

    if (actions[selectedAction].confirmation === true) {
      return (
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
      );
    }

    return (
      <IconButton
        disabled={selectedAction === Actions.PLACEHOLDER}
        color={"primary"}
        onClick={() => {
          handleDialogChoice(true);
        }}
      >
        <Check />
      </IconButton>
    );
  }, [selectedAction, reason]);

  const disabledActions = useMemo(() => {
    let disabled: Actions[] = [];

    // Only PA & ADMIN roles can use early check-in logic
    const isPaOrAdmin =
      pageContext === PageContextLevel.ADMIN ||
      pageContext === PageContextLevel.PA;

    if (!isPaOrAdmin) {
      return disabled;
    }

    const ONE_HOUR_MS = 60 * 60 * 1000;
    const now = Date.now();
    const bookingStart = startDate.toMillis();
    const oneHourBeforeStart = bookingStart - ONE_HOUR_MS;

    // Disable if we are earlier than one hour before start time
    if (now < oneHourBeforeStart) {
      disabled.push(Actions.CHECK_IN);
      return disabled;
    }

    // Determine if there is a conflicting booking in the preceding hour
    const currentBooking = allBookings?.find(
      (b) => b.calendarEventId === calendarEventId
    );

    if (currentBooking) {
      const roomId = currentBooking.roomId;
      const precedingWindowStart = bookingStart - ONE_HOUR_MS;

      const ALLOWED_PREV_STATUSES = [
        BookingStatusLabel.CANCELED,
        BookingStatusLabel.DECLINED,
        BookingStatusLabel.NO_SHOW,
        BookingStatusLabel.CHECKED_OUT,
      ];

      const hasBlockingBooking = allBookings?.some((b) => {
        if (b.calendarEventId === calendarEventId) return false; // skip current booking
        if (b.roomId !== roomId) return false; // different room

        const bStart = b.startDate.toDate().getTime();
        const bEnd = b.endDate.toDate().getTime();

        // overlap with the 1-hour window immediately before current booking start
        const overlapsPrecedingHour =
          bStart < bookingStart && bEnd > precedingWindowStart;

        if (!overlapsPrecedingHour) return false;

        const status = getBookingStatus(b);
        return !ALLOWED_PREV_STATUSES.includes(status);
      });

      if (hasBlockingBooking) {
        disabled.push(Actions.CHECK_IN);
      }
    }

    return disabled;
  }, [pageContext, startDate, allBookings, calendarEventId]);

  if (options().length === 0) {
    return <></>;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <Select
        value={selectedAction}
        size="small"
        displayEmpty
        onFocus={onFocus}
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
          <MenuItem
            disabled={disabledActions.includes(action)}
            value={action}
            key={action}
          >
            {action}
          </MenuItem>
        ))}
      </Select>
      {uiLoading ? (
        <Loading style={{ height: "24px", width: "24px", margin: 8 }} />
      ) : (
        onAction
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
