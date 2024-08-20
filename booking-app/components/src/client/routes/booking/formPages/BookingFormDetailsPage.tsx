"use client";

import FormInput from "../components/FormInput";
import Grid from "@mui/material/Unstable_Grid2";
import React from "react";

interface Props {
  calendarEventId?: string;
  isEdit?: boolean;
  isWalkIn?: boolean;
}

export default function BookingFormDetailsPage({
  calendarEventId,
  isEdit = false,
  isWalkIn = false,
}: Props) {
  return (
    <Grid container>
      <Grid width={330} />
      <Grid xs={7} paddingRight={2}>
        <FormInput {...{ isEdit, isWalkIn, calendarEventId }} />
      </Grid>
    </Grid>
  );
}
