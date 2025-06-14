import { Box, Typography } from "@mui/material";

import { PageContextLevel } from "@/components/src/types";
import { styled } from "@mui/system";
import { useTenantSchema } from "../components/SchemaProvider";
import { Bookings } from "../components/bookingTable/Bookings";

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
