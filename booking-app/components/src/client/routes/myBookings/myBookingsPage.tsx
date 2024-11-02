import { Box, Typography } from "@mui/material";

import { Bookings } from "../components/bookingTable/Bookings";
import { PageContextLevel } from "@/components/src/types";
import React from "react";
import { Tenants } from "@/components/src/policy";
import { styled } from "@mui/system";

const Center = styled(Box)`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

interface Props {
  tenant: Tenants;
}

export default function MyBookingsPage({ tenant }: Props) {
  return (
    <Center>
      <Box width={{ xs: "90%", md: "65%" }} margin={6}>
        <Typography variant="h6">
          Welcome to the {tenant} booking tool!
        </Typography>
        {tenant === Tenants.MEDIA_COMMONS && (
          <Bookings pageContext={PageContextLevel.USER} />
        )}
      </Box>
    </Center>
  );
}
