"use client";

import { Box, Stack, Typography, useMediaQuery, useTheme } from "@mui/material";
import dynamic from "next/dynamic";
import React, { useContext, useMemo, useState } from "react";

import { FormContextLevel } from "@/components/src/types";
import Grid from "@mui/material/Unstable_Grid2";
import { BookingContext } from "../bookingProvider";
import { CalendarDatePicker } from "../components/CalendarDatePicker";
import { DatabaseContext } from "../../components/Provider";
import { SelectRooms } from "../components/SelectRooms";
import useCheckFormMissingData from "../hooks/useCheckFormMissingData";
import { useTenantSchema } from "../../components/SchemaProvider";
import { getStartHour } from "../utils/getStartHour";
import { getSlotUnit } from "../utils/getSlotUnit";
import { getBookingHourLimits } from "../utils/bookingHourLimits";

const CalendarVerticalResource = dynamic(
  () => import("../components/CalendarVerticalResource"),
  {
    ssr: false,
    loading: () => (
      <Box sx={{ minHeight: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
        Loading calendar...
      </Box>
    ),
  },
);

interface Props {
  calendarEventId?: string;
  formContext?: FormContextLevel;
}

// Convert a schema resource to the RoomSetting format for compatibility
const resourceToRoomSetting = (
  resource: ReturnType<typeof useTenantSchema>["resources"][number],
) => ({
  ...resource,
  roomId: resource.resourceId,
  name: resource.name,
  capacity: resource.capacity.toString(),
  calendarId: resource.calendarId,
  calendarRef: undefined,
  needsSafetyTraining: resource.training?.required,
  trainingFormUrl: resource.training?.formId,
  trainingInfoUrl: resource.training?.infoUrl,
  autoApproval: resource.autoApproval,
  isWalkIn: resource.isWalkIn,
  isWalkInCanBookTwo: resource.isWalkInCanBookTwo,
  isEquipment: resource.isEquipment,
  services: resource.services,
  maxHour: resource.maxHour,
  minHour: resource.minHour,
  staffingServices: resource.staffingServices,
  staffingSections: resource.staffingSections,
});

export default function SelectRoomPage({
  calendarEventId,
  formContext = FormContextLevel.FULL_FORM,
}: Props) {
  const { roomSettings } = useContext(DatabaseContext);
  const { selectedRooms, setSelectedRooms, role, annexByRoom } =
    useContext(BookingContext);
  const [date, setDate] = useState<Date>(new Date());
  useCheckFormMissingData();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const isWalkIn = formContext === FormContextLevel.WALK_IN;
  const isVIP = formContext === FormContextLevel.VIP;
  const schema = useTenantSchema();

  const { maxHours } = useMemo(
    () => getBookingHourLimits(selectedRooms, role, isWalkIn, isVIP),
    [selectedRooms, role, isWalkIn, isVIP],
  );

  const roomsToShow = useMemo(() => {
    const { resources } = schema;

    // Annex resources are offered as checkboxes under their parent room,
    // never as standalone bookable rooms.
    const topLevelResources = resources.filter(
      (resource) => !resource.parentResourceId,
    );

    const convertedResources = topLevelResources.map(resourceToRoomSetting);

    const allRooms = !isWalkIn
      ? convertedResources
      : convertedResources.filter((room) => room.isWalkIn);

    return allRooms;
  }, [schema.resources, isWalkIn]);

  // Checked annex spaces get their own calendar column next to the parent
  // room, so their availability is visible even though they aren't
  // standalone-bookable.
  const calendarRooms = useMemo(() => {
    const selectedAnnexIds = new Set(
      Object.values(annexByRoom ?? {})
        .flat()
        .map(String),
    );
    if (selectedAnnexIds.size === 0) return selectedRooms;
    const annexRooms = schema.resources
      .filter(
        (resource) =>
          resource.parentResourceId &&
          selectedAnnexIds.has(resource.resourceId),
      )
      .map(resourceToRoomSetting);
    return [...selectedRooms, ...annexRooms];
  }, [selectedRooms, annexByRoom, schema.resources]);

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
            rooms={calendarRooms}
            dateView={date}
            {...{ calendarEventId, formContext }}
            startHour={getStartHour(schema.calendarConfig, formContext, role)}
            slotUnit={getSlotUnit(schema.calendarConfig, formContext, role)}
            maxHours={maxHours}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
