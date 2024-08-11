import { Box, Link, Typography } from "@mui/material";

import Button from "@mui/material/Button";
import React from "react";
import { styled } from "@mui/system";
import { useRouter } from "next/navigation";

const Center = styled(Box)`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`;

const Modal = styled(Center)(({ theme }) => ({
  border: `1px solid ${theme.palette.custom.border}`,
  borderRadius: 4,
  alignItems: "flex-start",
  marginTop: 20,
  maxWidth: 800,
}));

const Title = styled(Typography)`
  font-weight: 700;
  font-size: 20px;
  line-height: 1.25;
  margin-bottom: 12px;
`;

export default function LandingPage() {
  const router = useRouter();

  return (
    <Center sx={{ width: "100vw", height: "90vh" }}>
      <Title as="h1">370🅙 Media Commons Reservation Form</Title>
      <p>Thank you for your interest in booking with the Media Commons</p>
      <Modal padding={4}>
        <Typography fontWeight={500}>
          Please read our Policy for using the 370 Jay Street Shared Spaces
        </Typography>
        <Typography fontWeight={700} marginTop={3}>
          Booking Confirmation
        </Typography>
        <p>
          You will receive an email response from the 370J Operations team and a
          calendar invite once your request has been reviewed and processed.
          Please allow a minimum of 3 days for your request to be approved. If
          you do not hear back about your request within 48 hours, you can
          contact the Media Commons Team (
          <a href="mailto:mediacommons.reservations@nyu.edu">
            mediacommons.reservations@nyu.edu
          </a>
          ) to follow up. A request does not guarantee a booking.
        </p>
        <Typography fontWeight={700} marginTop={3}>
          Cancellation Policy
        </Typography>
        <p>
          To cancel reservations please email the Media Commons Team (
          <a href="mailto:mediacommons.reservations@nyu.edu">
            mediacommons.reservations@nyu.edu
          </a>
          ) at least 24 hours before the date of the event. Failure to cancel
          may result in restricted use of event spaces.
        </p>
        <Button
          variant="contained"
          color="primary"
          onClick={() => router.push("/book/role")}
          sx={{
            alignSelf: "center",
            marginTop: 6,
          }}
        >
          I accept
        </Button>
      </Modal>
    </Center>
  );
}
