import { Box, Typography } from "@mui/material";

import { Bookings } from "../components/bookingTable/Bookings";
import React from "react";
import { styled } from "@mui/system";

const Center = styled(Box)`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

export default function MyBookingsPage() {
  return (
    <Center>
      <Box width="65%" margin={6}>
        <Typography variant="h6">Welcome to the Media Commons booking tool!</Typography>
        <Bookings isUserView={true} />
      </Box>
    </Center>
  );
}
