"use client";

import FormInput from "../components/FormInput";
import Grid from "@mui/material/Unstable_Grid2";
import React from "react";
import useCheckFormMissingData from "../hooks/useCheckFormMissingData";

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
  useCheckFormMissingData();
  return (
    <Grid container>
      <Grid width={330} />
      <Grid xs={12} md={7} margin={2} paddingRight={{ xs: 0, md: 2 }}>
        <FormInput {...{ isEdit, isWalkIn, calendarEventId }} />
      </Grid>
    </Grid>
  );
}
