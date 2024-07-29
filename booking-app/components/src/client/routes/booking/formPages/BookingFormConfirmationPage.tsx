import { Box, Button, Typography, useTheme } from "@mui/material";
import React, { useContext } from "react";

import { BookingContext } from "../bookingProvider";
import { Event } from "@mui/icons-material";
import Loading from "../../components/Loading";
import { styled } from "@mui/system";
import { useRouter } from "next/navigation";

const Centered = styled(Box)`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 55vh;
`;

export default function BookingFormConfirmationPage() {
  const { submitting } = useContext(BookingContext);
  const router = useRouter();
  const theme = useTheme();

  // don't submit form via useEffect here b/c it submits twice in development strict mode

  if (submitting) {
    return (
      <Centered>
        <Box
          sx={{
            position: "absolute",
            top: "calc(50% - 40px)",
            left: "50%",
            transform: "translate(-50%, -100%)",
          }}
        >
          <Loading />
        </Box>
        <Typography variant="h6">Submitting your booking request...</Typography>
      </Centered>
    );
  }

  return (
    <Centered>
      <Box
        sx={{
          position: "absolute",
          top: "calc(50% - 40px)",
          left: "50%",
          transform: "translate(-50%, -100%)",
        }}
      >
        <Typography variant="h3" lineHeight="1.55rem">
          🎉
        </Typography>
      </Box>
      <Typography variant="h6" sx={{ padding: 3 }}>
        Yay! We've received your booking request
      </Typography>
      <Box
        sx={{
          position: "absolute",
          top: "calc(50% + 100px)",
          left: "50%",
          transform: "translate(-50%, 0%)",
        }}
      >
        <Button
          onClick={() => router.push("/")}
          variant="text"
          sx={{
            background: theme.palette.primary[50],
            color: theme.palette.primary.main,
          }}
        >
          <Event />
          View My Bookings
        </Button>
      </Box>
    </Centered>
  );
}
