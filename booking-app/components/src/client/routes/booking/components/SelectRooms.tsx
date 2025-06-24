import { Checkbox, FormControlLabel, FormGroup, Tooltip } from "@mui/material";
import dayjs from "dayjs";
import { useContext, useMemo } from "react";
import {
  MOCAP_ROOMS,
  WALK_IN_CAN_BOOK_TWO,
} from "../../../../mediaCommonsPolicy";
import { FormContextLevel, RoomSetting } from "../../../../types";

import { ConfirmDialogControlled } from "../../components/ConfirmDialog";
import { BookingContext } from "../bookingProvider";
import { useBookingDateRestrictions } from "../hooks/useBookingDateRestrictions";

interface Props {
  allRooms: RoomSetting[];
  formContext: FormContextLevel;
  selected: RoomSetting[];
  setSelected: any;
}

export const SelectRooms = ({
  allRooms,
  formContext,
  selected,
  setSelected,
}: Props) => {
  // if this isn't stored in the Provider then the modal will reshow when backtracking in the form which is annoying
  const { hasShownMocapModal, setHasShownMocapModal, bookingCalendarInfo } =
    useContext(BookingContext);
  const { getBlackoutPeriodsForDateAndRooms } = useBookingDateRestrictions();
  const selectedIds = selected.map((room) => room.roomId);

  const showMocapModal = useMemo(() => {
    const mocapRoomSelected = MOCAP_ROOMS.some((roomId) =>
      selectedIds.includes(roomId)
    );
    const shouldShow = !hasShownMocapModal && mocapRoomSelected;
    return shouldShow;
  }, [selectedIds, hasShownMocapModal]);

  // Get the current selected date for blackout checking
  const selectedDate = bookingCalendarInfo
    ? dayjs(bookingCalendarInfo.start)
    : null;

  // Check if a room is in blackout for the selected date
  const isRoomInBlackout = (
    roomId: number
  ): { inBlackout: boolean; periods: any[] } => {
    if (!selectedDate) return { inBlackout: false, periods: [] };

    const blackoutPeriods = getBlackoutPeriodsForDateAndRooms(selectedDate, [
      roomId,
    ]);
    return {
      inBlackout: blackoutPeriods.length > 0,
      periods: blackoutPeriods,
    };
  };

  // walk-ins can only book 1 room unless it's 2 ballroom bays (221-224)
  const isDisabled = (roomId: number) => {
    // Don't disable rooms for blackout periods - just show tooltips
    // Check if room is in blackout period
    // const blackoutInfo = isRoomInBlackout(roomId);
    // if (blackoutInfo.inBlackout) return true;

    if (formContext !== FormContextLevel.WALK_IN || selectedIds.length === 0)
      return false;
    if (selectedIds.includes(roomId)) return false;
    if (selectedIds.length >= 2) return true;
    if (
      WALK_IN_CAN_BOOK_TWO.includes(selectedIds[0]) &&
      WALK_IN_CAN_BOOK_TWO.includes(roomId)
    )
      return false;
    return true;
  };

  const getDisabledReason = (roomId: number): string | null => {
    const blackoutInfo = isRoomInBlackout(roomId);
    if (blackoutInfo.inBlackout) {
      const periodNames = blackoutInfo.periods.map((p) => p.name).join(", ");
      return `Room will be unavailable during selected time due to blackout period: ${periodNames}`;
    }

    if (formContext !== FormContextLevel.WALK_IN) return null;

    if (selectedIds.length === 0) return null;
    if (selectedIds.includes(roomId)) return null;
    if (selectedIds.length >= 2)
      return "Walk-in bookings are limited to 2 rooms maximum";
    if (
      WALK_IN_CAN_BOOK_TWO.includes(selectedIds[0]) &&
      WALK_IN_CAN_BOOK_TWO.includes(roomId)
    )
      return null;

    return "Walk-in bookings are limited to 1 room or 2 connected ballroom bays";
  };

  const handleCheckChange = (e: any, room: RoomSetting) => {
    const newVal: boolean = e.target.checked;
    setSelected((prev: RoomSetting[]) => {
      if (newVal) {
        return [...prev, room].sort(
          (a, b) => Number(a.roomId) - Number(b.roomId)
        );
      } else {
        return prev.filter((x: RoomSetting) => x.roomId != room.roomId);
      }
    });
  };

  return (
    <FormGroup>
      {allRooms.map((room: RoomSetting) => {
        const disabled = isDisabled(room.roomId);
        const disabledReason = getDisabledReason(room.roomId);

        const checkbox = (
          <FormControlLabel
            control={
              <Checkbox
                checked={selectedIds.includes(room.roomId)}
                onChange={(e) => handleCheckChange(e, room)}
                inputProps={{ "aria-label": "controlled" }}
                disabled={disabled}
              />
            }
            label={`${room.roomId} ${room.name}`}
            key={room.name}
            sx={{
              opacity: disabled ? 0.6 : 1,
              "& .MuiFormControlLabel-label": {
                textDecoration: disabled ? "line-through" : "none",
              },
            }}
          />
        );

        return disabledReason ? (
          <Tooltip title={disabledReason} key={room.name}>
            <span>{checkbox}</span>
          </Tooltip>
        ) : (
          checkbox
        );
      })}
      <ConfirmDialogControlled
        open={showMocapModal}
        onClose={() => setHasShownMocapModal(true)}
        message="Please note: If you intend to use the motion capture rig in Rooms 221 or 222, you'll need to book both rooms concurrently."
        title="Motion Capture"
      />
    </FormGroup>
  );
};
