"use client";

import { FormContextLevel, UserApiData } from "@/components/src/types";
import { useEffect, useState } from "react";

import BookingSelection from "../components/BookingSelection";
import { Box } from "@mui/material";
import FormInputsMediaCommons from "../components/FormInputsMediaCommons";
import Grid from "@mui/material/Unstable_Grid2";
import { Tenants } from "@/components/src/policy";
import { styled } from "@mui/system";
import { useAuth } from "../../../providers/AuthProvider";
import useCheckFormMissingData from "../hooks/useCheckFormMissingData";

interface Props {
  calendarEventId?: string;
  formContext?: FormContextLevel;
  tenant: Tenants;
}

export default function BookingFormDetailsPage({
  calendarEventId,
  formContext = FormContextLevel.FULL_FORM,
  tenant,
}: Props) {
  const { netId } = useAuth();
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

  let form = <></>;
  switch (tenant) {
    case Tenants.MEDIA_COMMONS:
      form = (
        <FormInputsMediaCommons
          {...{
            calendarEventId,
            formContext,
            userApiData,
          }}
        />
      );
      break;
    case Tenants.STAGING:
      form = <>TODO</>;
      break;
  }

  return (
    <Grid container>
      <Grid width={330} />
      <Grid xs={12} md={7} margin={2} paddingRight={{ xs: 0, md: 2 }}>
        <Center>
          <Container padding={8} marginTop={4} marginBottom={6}>
            <BookingSelection />
            {form}
          </Container>
        </Center>
      </Grid>
    </Grid>
  );
}

const Center = styled(Box)`
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const Container = styled(Box)(({ theme }) => ({
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  borderRadius: "4px",
  border: `1px solid ${theme.palette.custom.border}` || "#e3e3e3",
}));
