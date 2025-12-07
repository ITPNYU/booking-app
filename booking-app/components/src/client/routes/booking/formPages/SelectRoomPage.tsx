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
import useCheckFormMissingData from "../hooks/useCheckFormMissingData";
import { useTenantSchema } from "../../components/SchemaProvider";
import { getStartHour } from "../utils/getStartHour";

interface Props {
  calendarEventId?: string;
  formContext?: FormContextLevel;
}

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
    
    // Convert schema resources to RoomSetting format for compatibility
    const convertedResources = resources.map((resource) => ({
      ...resource,
      roomId: resource.roomId,
      name: resource.name,
      capacity: resource.capacity.toString(),
      calendarId: resource.calendarId,
      calendarRef: undefined,
      // Include the new schema fields for compatibility
      needsSafetyTraining: resource.needsSafetyTraining,
      shouldAutoApprove: resource.shouldAutoApprove,
      isWalkIn: resource.isWalkIn,
      isWalkInCanBookTwo: resource.isWalkInCanBookTwo,
      isEquipment: resource.isEquipment,
      services: resource.services,
      maxHour: resource.maxHour,
      minHour: resource.minHour,
      staffingServices: resource.staffingServices,
      staffingSections: resource.staffingSections,
    }));

    const allRooms = !isWalkIn
      ? convertedResources
      : convertedResources.filter((room) => {
          const resource = schema.resources.find((r: any) => r.roomId === room.roomId);
          return resource?.isWalkIn || false;
        });

    return allRooms;
  }, [schema.resources, isWalkIn]);

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
            startHour={getStartHour(schema.startHour, formContext)}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
