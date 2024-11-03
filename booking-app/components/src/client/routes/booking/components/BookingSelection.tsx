import { Alert, AlertTitle, Box, Typography } from "@mui/material";
import React, { useContext } from "react";

import { BookingContext } from "../../../providers/BookingFormProvider";
import { Event } from "@mui/icons-material";
import Grid from "@mui/material/Unstable_Grid2";
import { formatTimeAmPm } from "../../../utils/date";
import { styled } from "@mui/system";

export const RoomDetails = styled(Grid)`
  display: flex;
  align-items: center;
  label {
    font-weight: 700;
    margin-right: 4px;
  }
`;

const AlertHeader = styled(Alert)(({ theme }) => ({
  background: theme.palette.secondary.light,
  marginBottom: 0,

  ".MuiAlert-icon": {
    color: theme.palette.primary.main,
  },
}));

export default function BookingSelection() {
  const { selectedRooms, bookingCalendarInfo } = useContext(BookingContext);

  if (
    bookingCalendarInfo?.startStr == undefined ||
    bookingCalendarInfo?.endStr == undefined
  ) {
    return null;
  }
  return (
    <Box sx={{ paddingBottom: "24px" }} width="100%">
      <AlertHeader color="info" icon={<Event />} sx={{ marginBottom: 3 }}>
        <AlertTitle>Your Request</AlertTitle>
        <RoomDetails container>
          <label>Rooms:</label>
          <p>
            {selectedRooms
              .map((room) => `${room.roomId} ${room.name}`)
              .join(", ")}
          </p>
        </RoomDetails>
        <RoomDetails container>
          <label>Date:</label>
          <p>{new Date(bookingCalendarInfo.startStr).toLocaleDateString()}</p>
        </RoomDetails>
        <RoomDetails container>
          <label>Time:</label>
          <p>{`${formatTimeAmPm(
            new Date(bookingCalendarInfo.startStr)
          )} - ${formatTimeAmPm(new Date(bookingCalendarInfo.endStr))}`}</p>
        </RoomDetails>
      </AlertHeader>
    </Box>
  );
}
