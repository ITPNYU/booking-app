import { Box, Typography } from "@mui/material";

import { Bookings } from "../components/bookingTable/Bookings";
import { PageContextLevel } from "@/components/src/types";
import React from "react";
import { styled } from "@mui/system";
import { useTenantSchema } from "../components/SchemaProvider";

const Center = styled(Box)`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

export default function MyBookingsPage() {
  const schema = useTenantSchema();

  return (
    <Center>
      <Box width={{ xs: "90%", md: "65%" }} margin={6}>
        <Typography variant="h6">
          Welcome to the {schema.name} booking tool!
        </Typography>
        <Bookings pageContext={PageContextLevel.USER} />
      </Box>
    </Center>
  );
}
