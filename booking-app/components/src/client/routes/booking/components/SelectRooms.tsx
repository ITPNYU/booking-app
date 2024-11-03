import { Checkbox, FormControlLabel, FormGroup } from "@mui/material";
import { FormContextLevel, Resource } from "../../../../types";
import {
  MOCAP_ROOMS,
  WALK_IN_CAN_BOOK_TWO,
} from "../../../../mediaCommonsPolicy";
import { useContext, useMemo } from "react";

import { BookingContext } from "../../../providers/BookingFormProvider";
import { ConfirmDialogControlled } from "../../components/ConfirmDialog";

interface Props {
  allRooms: Resource[];
  formContext: FormContextLevel;
  selected: Resource[];
  setSelected: any;
}

export const SelectRooms = ({
  allRooms,
  formContext,
  selected,
  setSelected,
}: Props) => {
  // if this isn't stored in the Provider then the modal will reshow when backtracking in the form which is annoying
  const { hasShownMocapModal, setHasShownMocapModal } =
    useContext(BookingContext);
  const selectedIds = selected.map((room) => room.roomId);

  const showMocapModal = useMemo(() => {
    const mocapRoomSelected = MOCAP_ROOMS.some((roomId) =>
      selectedIds.includes(roomId)
    );
    const shouldShow = !hasShownMocapModal && mocapRoomSelected;
    return shouldShow;
  }, [selectedIds, hasShownMocapModal]);

  // walk-ins can only book 1 room unless it's 2 ballroom bays (221-224)
  const isDisabled = (roomId: number) => {
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

  const handleCheckChange = (e: any, room: Resource) => {
    const newVal: boolean = e.target.checked;
    setSelected((prev: Resource[]) => {
      if (newVal) {
        return [...prev, room].sort(
          (a, b) => Number(a.roomId) - Number(b.roomId)
        );
      } else {
        return prev.filter((x: Resource) => x.roomId != room.roomId);
      }
    });
  };

  return (
    <FormGroup>
      {allRooms.map((room: Resource) => (
        <FormControlLabel
          control={
            <Checkbox
              checked={selectedIds.includes(room.roomId)}
              onChange={(e) => handleCheckChange(e, room)}
              inputProps={{ "aria-label": "controlled" }}
              disabled={isDisabled(room.roomId)}
            />
          }
          label={`${room.roomId} ${room.name}`}
          key={room.name}
        />
      ))}
      <ConfirmDialogControlled
        open={showMocapModal}
        onClose={() => setHasShownMocapModal(true)}
        message="Please note: If you intend to use the motion capture rig in Rooms 221 or 222, you'll need to book both rooms concurrently."
        title="Motion Capture"
      />
    </FormGroup>
  );
};
