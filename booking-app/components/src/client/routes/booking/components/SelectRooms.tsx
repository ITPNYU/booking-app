import { Box, Checkbox, FormControlLabel, FormGroup, Tooltip } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import dayjs from "dayjs";
import { useContext, useMemo } from "react";
import { FormContextLevel, RoomSetting } from "../../../../types";

import { ConfirmDialogControlled } from "../../components/ConfirmDialog";
import { useTenantSchema } from "../../components/SchemaProvider";
import { getAnnexOptions } from "../../../../utils/resourceServicesUtils";
import { canRequestAuxiliarySpaces } from "../../../../utils/roleUtils";
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
    role,
    annexByRoom,
    setAnnexByRoom,
  } = useContext(BookingContext);
  const { isBookingTimeInBlackout } = useBookingDateRestrictions();
  const { resources, calendarConfig } = useTenantSchema();
  const selectedIds = selected.map((room) => String(room.roomId));
  // Fall back to the schema default (false) to match generateDefaultSchema;
  // tenants that set the field explicitly are unaffected.
  const allowMultipleResourceSelect =
    calendarConfig?.multipleResourceSelect ?? false;
  const showAnnex = canRequestAuxiliarySpaces(role);

  // Sort rooms by room number for consistent display order
  const sortedRooms = useMemo(
    () =>
      [...allRooms].sort((a, b) =>
        String(a.roomId).localeCompare(String(b.roomId), undefined, {
          numeric: true,
        }),
      ),
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
    roomId: string,
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
  const isDisabled = (roomId: string) => {
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
      (resource) => resource.resourceId === selectedIds[0],
    );
    const currentRoom = resources.find(
      (resource) => resource.resourceId === roomId,
    );

    if (selectedRoom?.isWalkInCanBookTwo && currentRoom?.isWalkInCanBookTwo) {
      return false;
    }
    return true;
  };

  const getDisabledReason = (roomId: string): string | null => {
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

    // Check if both selected room and current room can book two
    const selectedRoom = resources.find(
      (resource) => resource.resourceId === selectedIds[0],
    );
    const currentRoom = resources.find(
      (resource) => resource.resourceId === roomId,
    );

    if (selectedRoom?.isWalkInCanBookTwo && currentRoom?.isWalkInCanBookTwo) {
      return null;
    }

    return "Walk-in bookings are limited to 1 room or 2 connected ballroom bays";
  };

  const clearAnnexForRoom = (roomId: string) => {
    setAnnexByRoom((prev) => {
      if (!(roomId in prev)) return prev;
      const next = { ...prev };
      delete next[roomId];
      return next;
    });
  };

  const handleCheckChange = (e: any, room: RoomSetting) => {
    const newVal: boolean = e.target.checked;
    const normalizedRoom = { ...room, roomId: String(room.roomId) };

    if (newVal) {
      if (
        !allowMultipleResourceSelect &&
        selected.length > 0 &&
        !selected.some((r) => String(r.roomId) === normalizedRoom.roomId)
      ) {
        return;
      }

      if (!allowMultipleResourceSelect) {
        // Replace selection: drop annex for any previously selected parents.
        setAnnexByRoom({});
      }

      setSelected((prev: RoomSetting[]) => {
        if (prev.some((r) => String(r.roomId) === normalizedRoom.roomId)) {
          return prev;
        }
        return [...prev, normalizedRoom].sort((a, b) =>
          String(a.roomId).localeCompare(String(b.roomId), undefined, {
            numeric: true,
          }),
        );
      });
      return;
    }

    clearAnnexForRoom(normalizedRoom.roomId);
    setSelected((prev: RoomSetting[]) => {
      const newSelection = prev.filter(
        (r) => String(r.roomId) !== normalizedRoom.roomId,
      );
      if (newSelection.length === 0) {
        setBookingCalendarInfo(null);
      }
      return newSelection;
    });
  };

  const handleAnnexChange = (
    parentRoomId: string,
    optionValue: string,
    checked: boolean,
  ) => {
    setAnnexByRoom((prev) => {
      const current = prev[parentRoomId] ?? [];
      const nextValues = checked
        ? current.includes(optionValue)
          ? current
          : [...current, optionValue]
        : current.filter((v) => v !== optionValue);
      if (nextValues.length === 0) {
        const next = { ...prev };
        delete next[parentRoomId];
        return next;
      }
      return { ...prev, [parentRoomId]: nextValues };
    });
  };

  return (
    <FormGroup>
      {sortedRooms.map((room: RoomSetting) => {
        const roomId = String(room.roomId);
        const disabled = isDisabled(roomId);
        const disabledReason = getDisabledReason(roomId);
        const isSelected = selectedIds.includes(roomId);
        const annexOptions =
          showAnnex && isSelected ? getAnnexOptions(room, resources) : [];

        const checkbox = (
          <FormControlLabel
            control={
              <Checkbox
                checked={isSelected}
                onChange={(e) => handleCheckChange(e, room)}
                icon={
                  allowMultipleResourceSelect ? undefined : (
                    <RadioButtonUncheckedIcon />
                  )
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

        return (
          <Box key={room.name}>
            {disabledReason ? (
              <Tooltip title={disabledReason}>
                <span>{checkbox}</span>
              </Tooltip>
            ) : (
              checkbox
            )}
            {annexOptions.length > 0 && (
              <Box
                sx={{ pl: 3, display: "flex", flexDirection: "column" }}
                data-testid={`annex-options-${roomId}`}
              >
                {annexOptions.map((option) => (
                  <FormControlLabel
                    key={option.value}
                    control={
                      <Checkbox
                        size="small"
                        checked={(annexByRoom[roomId] ?? []).includes(
                          option.value,
                        )}
                        onChange={(e) =>
                          handleAnnexChange(
                            roomId,
                            option.value,
                            e.target.checked,
                          )
                        }
                        inputProps={{
                          "aria-label": option.label,
                        }}
                        data-testid={`annex-option-${option.value}`}
                      />
                    }
                    label={option.label}
                    sx={{
                      "& .MuiFormControlLabel-label": {
                        fontSize: "0.9rem",
                      },
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>
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
