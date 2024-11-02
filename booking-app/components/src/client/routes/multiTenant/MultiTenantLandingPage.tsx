import { Box, Button, Typography } from "@mui/material";

import React from "react";
import { styled } from "@mui/system";
import { useRouter } from "next/navigation";

const Center = styled(Box)`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Container = styled(Box)`
  margin-top: 32px;
  button {
    margin-right: 8px;
  }
`;

export default function MultiTenantLandingPage() {
  const router = useRouter();

  return (
    <Center>
      <Box width={{ xs: "90%", md: "65%" }} margin={6}>
        <Typography variant="h6">Welcome to the Booking Tool!</Typography>
        <Container>
          <Button
            onClick={() => router.push("/media-commons")}
            variant="contained"
          >
            Media Commons
          </Button>
          <Button onClick={() => router.push("/staging")} variant="contained">
            ITP Staging Space
          </Button>
        </Container>
      </Box>
    </Center>
  );
}
