import { Alert, AlertTitle, Box, Typography } from "@mui/material";
import React, { useContext } from "react";

import { Event } from "@mui/icons-material";
import Grid from "@mui/material/Unstable_Grid2";
import { styled } from "@mui/system";
import { formatTimeAmPm } from "../../../utils/date";
import { BookingContext } from "../bookingProvider";

export const RoomDetails = styled(Grid)`
  display: flex;
  align-items: center;
  span {
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
          <span>Rooms:</span>
          <p>
            {selectedRooms
              .map((room) => `${room.roomId} ${room.name}`)
              .join(", ")}
          </p>
        </RoomDetails>
        <RoomDetails container>
          <span>Date:</span>
          <p>{bookingCalendarInfo.start.toLocaleDateString()}</p>
        </RoomDetails>
        <RoomDetails container>
          <span>Time:</span>
          <p>{`${formatTimeAmPm(bookingCalendarInfo.start)} - ${formatTimeAmPm(
            bookingCalendarInfo.end,
          )}`}</p>
        </RoomDetails>
      </AlertHeader>
    </Box>
  );
}
