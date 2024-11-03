import { BookingStatusLabel, PageContextLevel } from "../../../../types";
import { IconButton, MenuItem, Select } from "@mui/material";
import React, { useContext, useMemo, useState } from "react";
import useBookingActions, {
  ActionDefinition,
  Actions,
} from "../hooks/useBookingActions";

import AlertToast from "../../components/AlertToast";
import Check from "@mui/icons-material/Check";
import ConfirmDialog from "../../components/ConfirmDialog";
import DeclineReasonDialog from "../../components/DeclineReasonDialog";
import Loading from "../../components/Loading";
import { SharedDatabaseContext } from "../../../providers/SharedDatabaseProvider";
import { Timestamp } from "@firebase/firestore";

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
  const { reloadBookings } = useContext(SharedDatabaseContext);
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
    reloadBookings();
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
          <MenuItem value={action} key={action}>
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
