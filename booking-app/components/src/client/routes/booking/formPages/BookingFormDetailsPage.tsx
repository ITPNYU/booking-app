"use client";

import { FormContextLevel } from "@/components/src/types";
import FormInput from "../components/FormInput";
import Grid from "@mui/material/Unstable_Grid2";
import React from "react";
import useCheckFormMissingData from "../hooks/useCheckFormMissingData";

interface Props {
  calendarEventId?: string;
  formContext?: FormContextLevel;
}

export default function BookingFormDetailsPage({
  calendarEventId,
  formContext = FormContextLevel.FULL_FORM,
}: Props) {
  useCheckFormMissingData();
  return (
    <Grid container>
      <Grid width={330} />
      <Grid xs={12} md={7} margin={2} paddingRight={{ xs: 0, md: 2 }}>
        <FormInput {...{ formContext, calendarEventId }} />
      </Grid>
    </Grid>
  );
}
