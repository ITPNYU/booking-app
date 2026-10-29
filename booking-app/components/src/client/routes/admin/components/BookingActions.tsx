import {
  AlertColor,
  IconButton,
  MenuItem,
  Portal,
  Select,
} from "@mui/material";
import { useContext, useMemo, useState } from "react";
import Check from "@mui/icons-material/Check";
import { Timestamp } from "firebase/firestore";
import { BookingStatusLabel, PageContextLevel } from "../../../../types";
import { ApprovedWithWarningError } from "../../../bookingActionClient";
import useBookingActions, {
  ActionDefinition,
  Actions,
} from "../hooks/useBookingActions";

import ActionNoteDialog from "../../components/ActionNoteDialog";
import AlertToast from "../../components/AlertToast";
import Loading from "../../components/Loading";
import { DatabaseContext } from "../../components/Provider";
import shouldDisableCheckIn from "../hooks/shouldDisableCheckIn";

const DEFAULT_ERROR_MESSAGE = "Failed to perform action on booking";

const LATE_CANCEL_WARNING =
  "Are you sure? This action can't be undone. This will be counted as a Late Cancelation if canceled less than 24 hours before the reservation start time.";

const OPTIONAL_NOTE_MESSAGE =
  "You can add a note. It will appear in the booking history.";

// Edit and Modification open another page. Send to Equipment goes through
// /api/equipment, which takes no note, and Equipment Approve does nothing.
const ACTIONS_WITHOUT_NOTE = new Set<Actions>([
  Actions.EDIT,
  Actions.MODIFICATION,
  Actions.SEND_TO_EQUIPMENT,
  Actions.EQUIPMENT_APPROVE,
]);

const isDeclineAction = (action: Actions) =>
  action === Actions.DECLINE ||
  (typeof action === "string" && action.startsWith("Decline "));

/** Title, message and whether a note is required for an action's dialog. */
const noteDialogFor = (action: Actions) => {
  if (isDeclineAction(action)) {
    return {
      title: action === Actions.DECLINE ? "Decline Booking" : action,
      message: "Please give a reason for declining this request.",
      required: true,
    };
  }
  if (action === Actions.CANCEL) {
    return {
      title: "Cancel Booking",
      message: `${LATE_CANCEL_WARNING} ${OPTIONAL_NOTE_MESSAGE}`,
      required: false,
    };
  }
  return { title: action, message: OPTIONAL_NOTE_MESSAGE, required: false };
};

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
    Actions.PLACEHOLDER,
  );
  const { reloadFutureBookings, allBookings } = useContext(DatabaseContext);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState(DEFAULT_ERROR_MESSAGE);
  const [toastSeverity, setToastSeverity] = useState<AlertColor>("error");
  const [note, setNote] = useState("");

  const { actions, updateActions, options } = useBookingActions({
    status,
    calendarEventId,
    pageContext,
    startDate,
    note,
  });

  const onFocus = () => {
    updateActions();
    onSelect();
  };

  const reload = async () => {
    reloadFutureBookings();
  };

  const onError = (error: unknown, severity: AlertColor = "error") => {
    // Show the server's message, e.g. when an approval succeeded but the
    // Google Calendar title could not be updated.
    setErrorMessage(
      error instanceof Error && error.message
        ? error.message
        : DEFAULT_ERROR_MESSAGE,
    );
    setToastSeverity(severity);
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
      if (ex instanceof ApprovedWithWarningError) {
        // The booking is approved: keep that status, warn, and load the real
        // row so approval is not offered again. Admin lists keep approved
        // rows, so this component (and its toast) stays mounted.
        onError(ex, "warning");
        await reload();
      } else {
        setOptimisticStatus(undefined);
        onError(ex);
      }
    } finally {
      setSelectedAction(Actions.PLACEHOLDER);
      setNote("");
      setUiLoading(false);
    }
  };

  const onAction = useMemo(() => {
    if (
      selectedAction !== Actions.PLACEHOLDER &&
      !ACTIONS_WITHOUT_NOTE.has(selectedAction)
    ) {
      const { title, message, required } = noteDialogFor(selectedAction);
      return (
        <ActionNoteDialog
          title={title}
          message={message}
          required={required}
          callback={handleDialogChoice}
          value={note}
          setValue={setNote}
        >
          <IconButton
            color={"primary"}
            aria-label={
              selectedAction === Actions.DECLINE
                ? "Confirm decline"
                : `Confirm ${selectedAction}`
            }
          >
            <Check />
          </IconButton>
        </ActionNoteDialog>
      );
    }

    return (
      <IconButton
        disabled={selectedAction === Actions.PLACEHOLDER}
        color={"primary"}
        onClick={() => {
          handleDialogChoice(true);
        }}
        aria-label={`Confirm ${selectedAction}`}
      >
        <Check />
      </IconButton>
    );
  }, [selectedAction, note]);

  const disabledActions = useMemo(() => {
    const shouldDisable = shouldDisableCheckIn({
      pageContext,
      startDate,
      calendarEventId,
      allBookings,
    });
    const disabled = shouldDisable ? [Actions.CHECK_IN] : [];

    // Disable Edit action for users when status is not REQUESTED or DECLINED
    if (pageContext === PageContextLevel.USER) {
      const isEditDisabled =
        status !== BookingStatusLabel.REQUESTED &&
        status !== BookingStatusLabel.DECLINED;
      if (isEditDisabled) {
        disabled.push(Actions.EDIT);
      }
    }

    return disabled;
  }, [pageContext, startDate, allBookings, calendarEventId, status]);

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
      {/* Rendered in a grid cell; portal it so the row does not clip it. */}
      <Portal>
        <AlertToast
          message={errorMessage}
          severity={toastSeverity}
          open={showError}
          handleClose={() => setShowError(false)}
        />
      </Portal>
    </div>
  );
}
