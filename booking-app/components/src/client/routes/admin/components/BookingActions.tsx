import {
  AlertColor,
  Box,
  Button,
  IconButton,
  MenuItem,
  Popover,
  Portal,
  Select,
  TextField,
  Tooltip,
} from "@mui/material";
import { useContext, useMemo, useState } from "react";
import Check from "@mui/icons-material/Check";
import NoteAddOutlined from "@mui/icons-material/NoteAddOutlined";
import { Timestamp } from "firebase/firestore";
import { BookingStatusLabel, PageContextLevel } from "../../../../types";
import { MAX_ACTION_NOTE_LENGTH } from "../../../../utils/bookingHistoryNotes";
import { ApprovedWithWarningError } from "../../../bookingActionClient";
import useBookingActions, {
  ActionDefinition,
  Actions,
} from "../hooks/useBookingActions";

import ActionNoteDialog from "../../components/ActionNoteDialog";
import AlertToast from "../../components/AlertToast";
import ConfirmDialog from "../../components/ConfirmDialog";
import Loading from "../../components/Loading";
import { DatabaseContext } from "../../components/Provider";
import shouldDisableCheckIn from "../hooks/shouldDisableCheckIn";
import ReassignRequesterDialog, {
  ReassignResult,
} from "./ReassignRequesterDialog";

const DEFAULT_ERROR_MESSAGE = "Failed to perform action on booking";

const LATE_CANCEL_WARNING =
  "Are you sure? This action can't be undone. This will be counted as a Late Cancelation if canceled less than 24 hours before the reservation start time.";

// Edit and Modification open another page. Send to Equipment goes through
// /api/equipment, which takes no note, and Equipment Approve does nothing.
// Reassign Requester has its own dialog and writes its own history note.
const ACTIONS_WITHOUT_NOTE = new Set<Actions>([
  Actions.EDIT,
  Actions.MODIFICATION,
  Actions.SEND_TO_EQUIPMENT,
  Actions.EQUIPMENT_APPROVE,
  Actions.REASSIGN,
]);

const isDeclineAction = (action: Actions) =>
  action === Actions.DECLINE ||
  (typeof action === "string" && action.startsWith("Decline "));

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
  const { fetchAllBookings, allBookings } = useContext(DatabaseContext);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState(DEFAULT_ERROR_MESSAGE);
  const [toastSeverity, setToastSeverity] = useState<AlertColor>("error");
  const [note, setNote] = useState("");
  const [noteAnchor, setNoteAnchor] = useState<HTMLElement | null>(null);

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

  // Refetch with the dashboard's current search and date range. A full future
  // reload drops the server-side search and the row the user just acted on
  // disappears from the result.
  const reload = async () => {
    try {
      await fetchAllBookings(false);
    } catch {
      // The action already settled, and fetchBookings logs the error. A failed
      // refresh must not revert the row or look like the action failed.
    }
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
    skipReload,
  }: ActionDefinition) => {
    setUiLoading(true);
    setOptimisticStatus(optimisticNextStatus);

    try {
      await action();
      if (!skipReload) {
        await reload();
      }
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

  const onReassigned = async ({ name, warning }: ReassignResult) => {
    setSelectedAction(Actions.PLACEHOLDER);
    if (warning) {
      onError(new Error(warning), "warning");
    } else {
      setErrorMessage(`Booking reassigned to ${name}.`);
      setToastSeverity("success");
      setShowError(true);
    }
    setUiLoading(true);
    await reload();
    setUiLoading(false);
  };

  const onAction = useMemo(() => {
    if (selectedAction === Actions.REASSIGN) {
      const booking = allBookings.find(
        (b) => b.calendarEventId === calendarEventId,
      );
      return (
        <ReassignRequesterDialog
          calendarEventId={calendarEventId}
          currentRequester={
            booking && {
              firstName: booking.firstName,
              lastName: booking.lastName,
              email: booking.email,
              role: booking.role,
            }
          }
          onDone={onReassigned}
        >
          <IconButton color={"primary"} aria-label="Confirm Reassign Requester">
            <Check />
          </IconButton>
        </ReassignRequesterDialog>
      );
    }

    const confirmLabel =
      selectedAction === Actions.DECLINE
        ? "Confirm decline"
        : `Confirm ${selectedAction}`;

    // Declines need a reason, asked for in a dialog.
    if (isDeclineAction(selectedAction)) {
      return (
        <ActionNoteDialog
          title={
            selectedAction === Actions.DECLINE
              ? "Decline Booking"
              : selectedAction
          }
          message="Please give a reason for declining this request."
          required
          callback={handleDialogChoice}
          value={note}
          setValue={setNote}
        >
          <IconButton color={"primary"} aria-label={confirmLabel}>
            <Check />
          </IconButton>
        </ActionNoteDialog>
      );
    }

    if (selectedAction === Actions.CANCEL) {
      return (
        <ConfirmDialog
          message={LATE_CANCEL_WARNING}
          callback={handleDialogChoice}
        >
          <IconButton color={"primary"} aria-label={confirmLabel}>
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
        aria-label={confirmLabel}
      >
        <Check />
      </IconButton>
    );
  }, [selectedAction, note, allBookings, calendarEventId]);

  // Staff can attach an optional note to the selected action. It is saved on
  // the history entry the action writes. Declines take their reason in the
  // dialog instead.
  const canAddActionNote =
    pageContext !== PageContextLevel.USER &&
    selectedAction !== Actions.PLACEHOLDER &&
    !isDeclineAction(selectedAction) &&
    !ACTIONS_WITHOUT_NOTE.has(selectedAction);
  const hasNote = note.trim().length > 0;

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
        onChange={(e) => {
          setSelectedAction(e.target.value as Actions);
          // A note belongs to the action it was written for.
          setNote("");
        }}
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
      {!uiLoading && canAddActionNote && (
        <>
          <Tooltip title={hasNote ? "Edit note" : "Add a note (optional)"}>
            <IconButton
              size="small"
              color={hasNote ? "primary" : "default"}
              aria-label={hasNote ? "Edit note" : "Add a note"}
              onClick={(e) => setNoteAnchor(e.currentTarget)}
            >
              <NoteAddOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
          <Popover
            open={noteAnchor != null}
            anchorEl={noteAnchor}
            onClose={() => setNoteAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          >
            <Box sx={{ p: 2, width: 320 }}>
              <TextField
                label={`Note for ${selectedAction} (optional)`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                multiline
                minRows={2}
                fullWidth
                autoFocus
                inputProps={{ maxLength: MAX_ACTION_NOTE_LENGTH }}
              />
              <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
                <Button size="small" onClick={() => setNoteAnchor(null)}>
                  Done
                </Button>
              </Box>
            </Box>
          </Popover>
        </>
      )}
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
