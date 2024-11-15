"use client";

import { FormContextLevel } from "@/components/src/types";
import Grid from "@mui/material/Unstable_Grid2";
import { useContext } from "react";
import { DatabaseContext } from "../../components/Provider";
import FormInput from "../components/FormInput";
import useCheckFormMissingData from "../hooks/useCheckFormMissingData";

interface Props {
  calendarEventId?: string;
  formContext?: FormContextLevel;
}

export default function BookingFormDetailsPage({
  calendarEventId,
  formContext = FormContextLevel.FULL_FORM,
}: Props) {
  const { userApiData } = useContext(DatabaseContext);
  useCheckFormMissingData();
  return (
    <Grid container>
      <Grid width={330} />
      <Grid xs={12} md={7} margin={2} paddingRight={{ xs: 0, md: 2 }}>
        <FormInput {...{ formContext, calendarEventId, userApiData }} />
      </Grid>
    </Grid>
  );
}
