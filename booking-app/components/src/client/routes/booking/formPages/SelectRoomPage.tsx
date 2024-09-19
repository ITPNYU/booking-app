"use client";

import { Box, Stack, Typography, useMediaQuery, useTheme } from "@mui/material";
import React, { useContext, useMemo, useState } from "react";

import { BookingContext } from "../bookingProvider";
import { CalendarDatePicker } from "../components/CalendarDatePicker";
import CalendarVerticalResource from "../components/CalendarVerticalResource";
import { DatabaseContext } from "../../components/Provider";
import Grid from "@mui/material/Unstable_Grid2";
import { SelectRooms } from "../components/SelectRooms";
import { WALK_IN_ROOMS } from "@/components/src/policy";
import useCheckFormMissingData from "../hooks/useCheckFormMissingData";

interface Props {
  calendarEventId?: string;
  isEdit?: boolean;
  isWalkIn?: boolean;
}

export default function SelectRoomPage({
  calendarEventId,
  isEdit = false,
  isWalkIn = false,
}: Props) {
  const { roomSettings } = useContext(DatabaseContext);
  const { selectedRooms, setSelectedRooms } = useContext(BookingContext);
  const [date, setDate] = useState<Date>(new Date());
  useCheckFormMissingData();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const roomsToShow = useMemo(() => {
    return !isWalkIn
      ? roomSettings
      : roomSettings.filter((room) => WALK_IN_ROOMS.includes(room.roomId));
  }, [roomSettings]);

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Grid container={!isMobile}>
        <Grid width={{ xs: "100%", md: 330 }}>
          <Stack
            spacing={{ xs: 0, md: 2 }}
            alignItems={{ xs: "center", md: "unset" }}
          >
            {!isWalkIn && <CalendarDatePicker handleChange={setDate} />}
            <Box paddingLeft="24px">
              <Typography fontWeight={500}>Spaces</Typography>
              <SelectRooms
                allRooms={roomsToShow}
                isWalkIn={isWalkIn}
                selected={selectedRooms}
                setSelected={setSelectedRooms}
              />
            </Box>
          </Stack>
        </Grid>
        <Grid paddingRight={2} flex={1}>
          <CalendarVerticalResource
            rooms={selectedRooms}
            dateView={date}
            {...{ isEdit, calendarEventId }}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
