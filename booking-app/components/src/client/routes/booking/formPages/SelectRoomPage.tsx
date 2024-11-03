"use client";

import { Box, Stack, Typography, useMediaQuery, useTheme } from "@mui/material";
import { useContext, useMemo, useState } from "react";

import { BookingContext } from "../../../providers/BookingFormProvider";
import { CalendarDatePicker } from "../components/CalendarDatePicker";
import CalendarVerticalResource from "../components/CalendarVerticalResource";
import { FormContextLevel } from "@/components/src/types";
import Grid from "@mui/material/Unstable_Grid2";
import { SelectRooms } from "../components/SelectRooms";
import { SharedDatabaseContext } from "../../../providers/SharedDatabaseProvider";
import { WALK_IN_ROOMS } from "@/components/src/mediaCommonsPolicy";
import useCheckFormMissingData from "../hooks/useCheckFormMissingData";

interface Props {
  calendarEventId?: string;
  formContext?: FormContextLevel;
}

export default function SelectRoomPage({
  calendarEventId,
  formContext = FormContextLevel.FULL_FORM,
}: Props) {
  const { resources } = useContext(SharedDatabaseContext);
  const { selectedRooms, setSelectedRooms } = useContext(BookingContext);
  const [date, setDate] = useState<Date>(new Date());
  useCheckFormMissingData();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const isWalkIn = formContext === FormContextLevel.WALK_IN;

  const roomsToShow = useMemo(() => {
    return !isWalkIn
      ? resources
      : resources.filter((room) => WALK_IN_ROOMS.includes(room.roomId));
  }, [resources]);

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
