"use client";

import { FormContextLevel } from "@/components/src/types";
import Grid from "@mui/material/Unstable_Grid2";
import ServicesInput from "../components/ServicesInput";
import useCheckFormMissingData from "../hooks/useCheckFormMissingData";

interface Props {
  calendarEventId?: string;
  formContext?: FormContextLevel;
}

/** The Services step: the request's service requests, one section per service and resource. */
export default function BookingFormServicesPage({
  calendarEventId,
  formContext = FormContextLevel.FULL_FORM,
}: Props) {
  useCheckFormMissingData();
  return (
    <Grid container>
      <Grid width={330} />
      <Grid xs={12} md={7} margin={2} paddingRight={{ xs: 0, md: 2 }}>
        <ServicesInput {...{ formContext, calendarEventId }} />
      </Grid>
    </Grid>
  );
}
