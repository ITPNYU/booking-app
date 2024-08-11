"use client";

import { Alert, Box, List, ListItem, Typography } from "@mui/material";

import Button from "@mui/material/Button";
import { Description } from "@mui/icons-material";
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

const Bulleted = styled(List)`
  list-style-type: disc;
  padding: 0px 0px 0px 32px;
  li {
    display: list-item;
    padding: 0;
  }
`;

const AlertHeader = styled(Alert)(({ theme }) => ({
  background: theme.palette.secondary.light,
  alignItems: "center",

  ".MuiAlert-icon": {
    color: theme.palette.primary.main,
  },
}));

export default function WalkInLandingPage() {
  const router = useRouter();

  return (
    <Center sx={{ width: "100vw", height: "90vh" }}>
      <Title as="h1">370🅙 Media Commons Walk-In Reservation Form</Title>
      <Modal padding={4}>
        <Box width="100%">
          <AlertHeader color="info" icon={<Description />}>
            Policy Reminders
          </AlertHeader>
        </Box>
        <Typography fontWeight={700} marginTop={3}>
          Audio Lab (230) has different hours for Walk-Ins
        </Typography>
        <Bulleted>
          <ListItem>
            M-F 10am - 6pm staffed hours (audio engineer on site)
          </ListItem>
          <ListItem>
            M-F 6pm - 9pm playback hours (no staff, multichannel speakers and
            RME)
          </ListItem>
          <ListItem>
            Sa 11am - 6pm playback hours (no staff, multichannel speakers and
            RME)
          </ListItem>
        </Bulleted>
        <Button
          variant="contained"
          color="primary"
          onClick={() => router.push("/walk-in/role")}
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
