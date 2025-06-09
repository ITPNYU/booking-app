"use client";

import { Box, Stack, Typography, useMediaQuery, useTheme } from "@mui/material";
import React, { useContext, useMemo, useState } from "react";

import { BookingContext } from "../bookingProvider";
import { CalendarDatePicker } from "../components/CalendarDatePicker";
import CalendarVerticalResource from "../components/CalendarVerticalResource";
import { DatabaseContext } from "../../components/Provider";
import { FormContextLevel } from "@/components/src/types";
import Grid from "@mui/material/Unstable_Grid2";
import { SelectRooms } from "../components/SelectRooms";
import { WALK_IN_ROOMS } from "@/components/src/mediaCommonsPolicy";
import useCheckFormMissingData from "../hooks/useCheckFormMissingData";
import { useTenantSchema } from "../../components/SchemaProvider";
interface Props {
  calendarEventId?: string;
  formContext?: FormContextLevel;
}

// !!! CHECK THIS !!!
// - All mentions to rooms should be changed to resources
// - Change spaces to resources
export default function SelectRoomPage({
  calendarEventId,
  formContext = FormContextLevel.FULL_FORM,
}: Props) {
  const { roomSettings } = useContext(DatabaseContext);
  const { selectedRooms, setSelectedRooms } = useContext(BookingContext);
  const [date, setDate] = useState<Date>(new Date());
  useCheckFormMissingData();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const isWalkIn = formContext === FormContextLevel.WALK_IN;
  const schema = useTenantSchema();

  const roomsToShow = useMemo(() => {
    const { resources } = schema;
    const allRooms = !isWalkIn
      ? roomSettings
      : roomSettings.filter((room) => WALK_IN_ROOMS.includes(room.roomId));

    // TODO: Request all rooms from schema API in database context.
    return allRooms.filter((room) =>
      resources.some((r) => r.roomId === room.roomId)
    );
  }, [roomSettings]);

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Grid container={!isMobile}>
        <Grid width={{ xs: "100%", md: 330 }}>
          <Stack
            spacing={{ xs: 0, md: 2 }}
            alignItems={{ xs: "center", md: "unset" }}
          >
            <CalendarDatePicker
              handleChange={setDate}
              formContext={formContext}
            />
            <Box paddingLeft="24px">
              <Typography fontWeight={500}>Spaces</Typography>
              <SelectRooms
                allRooms={roomsToShow}
                formContext={formContext}
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
            {...{ calendarEventId, formContext }}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
