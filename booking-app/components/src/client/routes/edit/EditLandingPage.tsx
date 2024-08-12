"use client";

import { Box, Typography } from "@mui/material";

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

interface Props {
  calendarEventId: string;
}

export default function EditLandingPage({ calendarEventId }: Props) {
  const router = useRouter();

  return (
    <Center sx={{ width: "100vw", height: "90vh" }}>
      <Title as="h1">370🅙 Media Commons Reservation Form</Title>
      <Modal padding={4}>
        <Typography fontWeight={700}>
          Please read our Policy for editing an existing reservation
        </Typography>
        <Typography fontWeight={700} marginTop={3}>
          Reservation Edit Policy
        </Typography>
        <p>
          Submitting a change to your existing reservation will restart the
          approval process. Currently approved reservations will be subject to
          re-approval.
        </p>
        <Button
          variant="contained"
          color="primary"
          onClick={() => router.push("/edit/role/" + calendarEventId)}
          sx={{
            alignSelf: "center",
            marginTop: 6,
          }}
        >
          Start
        </Button>
      </Modal>
    </Center>
  );
}
