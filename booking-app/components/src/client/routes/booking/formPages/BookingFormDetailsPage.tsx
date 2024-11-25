"use client";

import { FormContextLevel, UserApiData } from "@/components/src/types";
import Grid from "@mui/material/Unstable_Grid2";
import { useContext, useEffect, useState } from "react";
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
  const { netId } = useContext(DatabaseContext);
  useCheckFormMissingData();
  const [userApiData, setUserApiData] = useState<UserApiData | undefined>(
    undefined
  );
  useEffect(() => {
    const fetchUserData = async () => {
      if (!netId) return;

      try {
        const response = await fetch(`/api/nyu/identity/${netId}`);

        if (response.ok) {
          const data = await response.json();
          setUserApiData(data);
        }
      } catch (err) {
        console.error("Failed to fetch user data:", err);
      }
    };

    fetchUserData();
  }, [netId]);
  return (
    <Grid container>
      <Grid width={330} />
      <Grid xs={12} md={7} margin={2} paddingRight={{ xs: 0, md: 2 }}>
        <FormInput {...{ formContext, calendarEventId, userApiData }} />
      </Grid>
    </Grid>
  );
}
