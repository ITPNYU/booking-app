"use client";

import { Box, List, ListItem, Typography } from "@mui/material";

import Button from "@mui/material/Button";
import { styled } from "@mui/system";
import { useParams, useRouter } from "next/navigation";

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

interface Props {
  calendarEventId: string;
}

export default function ModificationLandingPage({ calendarEventId }: Props) {
  const router = useRouter();
  const { tenant } = useParams();

  return (
    <Center sx={{ width: "100vw", height: "70vh" }}>
      <Title as="h1">370🅙 Media Commons Reservation Form</Title>
      <Modal padding={4}>
        <Typography fontWeight={700}>
          Policy reminders for modifying a reservation
        </Typography>
        <Typography fontWeight={700} marginTop={3}>
          Reservation Modification Policy
        </Typography>
        <p>You may modify</p>
        <Bulleted>
          <ListItem>Reservation title</ListItem>
          <ListItem>Reservation description</ListItem>
          <ListItem>
            Reservation start and end time (date changes allowed)
          </ListItem>
          <ListItem>Selected rooms</ListItem>
          <ListItem>Equipment checkout</ListItem>
          <ListItem>Number of expected attendees</ListItem>
        </Bulleted>
        <Button
          variant="contained"
          color="primary"
          onClick={() =>
            router.push(`/${tenant}/modification/selectRoom/${calendarEventId}`)
          }
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
