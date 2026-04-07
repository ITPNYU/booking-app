import { Checkbox, FormControlLabel, FormGroup, Tooltip } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import dayjs from "dayjs";
import { useContext, useMemo } from "react";
import { FormContextLevel, RoomSetting } from "../../../../types";

import { ConfirmDialogControlled } from "../../components/ConfirmDialog";
import { useTenantSchema } from "../../components/SchemaProvider";
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
  const {
    hasShownMocapModal,
    setHasShownMocapModal,
    bookingCalendarInfo,
    setBookingCalendarInfo,
  } = useContext(BookingContext);
  const { isBookingTimeInBlackout } = useBookingDateRestrictions();
  const { resources, calendarConfig } = useTenantSchema();
  const selectedIds = selected.map((room) => room.roomId);
  const allowMultipleResourceSelect =
    calendarConfig?.multipleResourceSelect ?? false;

  // Sort rooms by room number for consistent display order
  const sortedRooms = useMemo(
    () => [...allRooms].sort((a, b) => a.roomId - b.roomId),
    [allRooms],
  );

  // Remove this
  const showMocapModal = useMemo(() => {
    const mocapRoomSelected = false; // MOCAP_ROOMS.some((roomId) =>
    //   selectedIds.includes(roomId)
    // );
    const shouldShow = !hasShownMocapModal && mocapRoomSelected;
    return shouldShow;
  }, [selectedIds, hasShownMocapModal]);

  // Check if a room is in blackout for the selected booking time
  const isRoomInBlackout = (
    roomId: number,
  ): { inBlackout: boolean; periods: any[] } => {
    if (!bookingCalendarInfo) return { inBlackout: false, periods: [] };

    const bookingStart = dayjs(bookingCalendarInfo.start);
    const bookingEnd = dayjs(bookingCalendarInfo.end);

    // Use the new time-aware blackout checking
    const result = isBookingTimeInBlackout(bookingStart, bookingEnd, [roomId]);
    return {
      inBlackout: result.inBlackout,
      periods: result.affectedPeriods,
    };
  };

  // walk-ins can only book 1 room unless it's 2 ballroom bays (221-224)
  const isDisabled = (roomId: number) => {
    if (!allowMultipleResourceSelect) {
      if (selectedIds.length === 0) return false;
      if (selectedIds.includes(roomId)) return false;
      return true;
    }

    // Don't disable rooms for blackout periods - let the calendar handle time restrictions
    // Only apply walk-in restrictions
    if (formContext !== FormContextLevel.WALK_IN || selectedIds.length === 0)
      return false;
    if (selectedIds.includes(roomId)) return false;
    if (selectedIds.length >= 2) return true;

    // Check if both selected room and current room can book two
    const selectedRoom = resources.find(
      (r: any) => r.roomId === selectedIds[0],
    );
    const currentRoom = resources.find((r: any) => r.roomId === roomId);

    if (selectedRoom?.isWalkInCanBookTwo && currentRoom?.isWalkInCanBookTwo) {
      return false;
    }
    return true;
  };

  const getDisabledReason = (roomId: number): string | null => {
    const blackoutInfo = isRoomInBlackout(roomId);
    if (blackoutInfo.inBlackout) {
      const periodNames = blackoutInfo.periods.map((p) => p.name).join(", ");
      return `Room will be unavailable during selected time due to blackout period: ${periodNames}`;
    }

    if (!allowMultipleResourceSelect) {
      if (selectedIds.length === 0) return null;
      if (selectedIds.includes(roomId)) return null;
      return "Selecting multiple resources is currently disabled for this tenant";
    }

    if (formContext !== FormContextLevel.WALK_IN) return null;

    if (selectedIds.length === 0) return null;
    if (selectedIds.includes(roomId)) return null;
    if (selectedIds.length >= 2)
      return "Walk-in bookings are limited to 2 rooms maximum";

    // Check if both selected room and current room can book two
    const selectedRoom = resources.find(
      (r: any) => r.roomId === selectedIds[0],
    );
    const currentRoom = resources.find((r: any) => r.roomId === roomId);

    if (selectedRoom?.isWalkInCanBookTwo && currentRoom?.isWalkInCanBookTwo) {
      return null;
    }

    return "Walk-in bookings are limited to 1 room or 2 connected ballroom bays";
  };

  const handleCheckChange = (e: any, room: RoomSetting) => {
    const newVal: boolean = e.target.checked;
    setSelected((prev: RoomSetting[]) => {
      if (newVal) {
        if (
          !allowMultipleResourceSelect &&
          prev.length > 0 &&
          !prev.some((r) => r.roomId === room.roomId)
        ) {
          return prev;
        }

        const newSelection = [...prev, room].sort(
          (a, b) => a.roomId - b.roomId,
        );
        return newSelection;
      }
      const newSelection = prev.filter((r) => r.roomId !== room.roomId);
      if (newSelection.length === 0) {
        setBookingCalendarInfo(null);
      }
      return newSelection;
    });
  };

  return (
    <FormGroup>
      {sortedRooms.map((room: RoomSetting) => {
        const disabled = isDisabled(room.roomId);
        const disabledReason = getDisabledReason(room.roomId);

        const checkbox = (
          <FormControlLabel
            control={
              <Checkbox
                checked={selectedIds.includes(room.roomId)}
                onChange={(e) => handleCheckChange(e, room)}
                icon={
                  allowMultipleResourceSelect ? undefined : <RadioButtonUncheckedIcon />
                }
                checkedIcon={
                  allowMultipleResourceSelect ? undefined : <CheckCircleIcon />
                }
                inputProps={{
                  "aria-label": `${room.roomId} ${room.name}`,
                }}
                data-testid={`room-option-${room.roomId}`}
                disabled={disabled}
              />
            }
            label={`${room.roomId} ${room.name}`}
            key={room.name}
            sx={{
              opacity: disabled ? 0.6 : 1,
              "& .MuiFormControlLabel-label": {
                color: disabled ? "text.disabled" : "text.primary",
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
