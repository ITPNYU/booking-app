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
import shouldDisableCheckIn from "../hooks/shouldDisableCheckIn";

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
    if (result && actions[selectedAction]) {
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
    // 最初にselectedActionがPlaceholderまたは無効な値かチェック
    if (selectedAction === Actions.PLACEHOLDER || !actions[selectedAction]) {
      return (
        <IconButton disabled={true} color={"primary"}>
          <Check />
        </IconButton>
      );
    }

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

    if (
      "confirmation" in actions[selectedAction] &&
      actions[selectedAction].confirmation === true
    ) {
      return (
        <ConfirmDialog
          message="Are you sure? This action can't be undone."
          callback={handleDialogChoice}
        >
          <IconButton color={"primary"}>
            <Check />
          </IconButton>
        </ConfirmDialog>
      );
    }

    return (
      <IconButton
        color={"primary"}
        onClick={() => {
          handleDialogChoice(true);
        }}
      >
        <Check />
      </IconButton>
    );
  }, [selectedAction, reason, actions]);

  const disabledActions = useMemo(() => {
    const shouldDisable = shouldDisableCheckIn({
      pageContext,
      startDate,
      calendarEventId,
      allBookings,
    });
    return shouldDisable ? [Actions.CHECK_IN] : [];
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
          // Convert enum key to enum value if needed
          const actionKey = selected as string;
          const displayText = (Actions as any)[actionKey] || selected;
          return displayText;
        }}
        sx={{
          width: 125,
        }}
      >
        <MenuItem value={Actions.PLACEHOLDER} sx={{ color: "gray" }}>
          <em>Action</em>
        </MenuItem>
        {options().map((action) => {
          // Convert enum key to enum value if needed
          const actionKey = action as string;
          const displayText = (Actions as any)[actionKey] || action;

          return (
            <MenuItem
              disabled={disabledActions.includes(action)}
              value={action}
              key={action}
            >
              {displayText}
            </MenuItem>
          );
        })}
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
