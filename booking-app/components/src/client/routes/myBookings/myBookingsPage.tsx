import { Box, Typography } from "@mui/material";

import { PageContextLevel } from "@/components/src/types";
import { styled } from "@mui/system";
import { Bookings } from "../components/bookingTable/Bookings";

const Center = styled(Box)`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Container = styled(Box)`
  width: 65%;
  margin: 48px;
`;

export default function MyBookingsPage() {
  return (
    <Center>
      <Box width={{ xs: "90%", md: "65%" }} margin={6}>
        <Typography variant="h6">
          Welcome to the Media Commons booking tool!
        </Typography>
        <Bookings pageContext={PageContextLevel.USER} />
      </Box>
    </Center>
  );
}
