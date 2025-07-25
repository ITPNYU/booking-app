"use client";

import { Alert, Box, List, ListItem, Typography } from "@mui/material";

import Button from "@mui/material/Button";
import { Description } from "@mui/icons-material";
import React from "react";
import { styled } from "@mui/system";
import { useRouter, useParams } from "next/navigation";
import { FormContextLevel } from "@/components/src/types";
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

interface WalkInLandingPageProps {
  formContext?: FormContextLevel;
}

export default function WalkInLandingPage({
  formContext = FormContextLevel.FULL_FORM,
}: WalkInLandingPageProps) {
  const router = useRouter();
  const { tenant } = useParams();
  const isVIP = formContext === FormContextLevel.VIP;
  const title = isVIP ? "VIP" : "Walk-In";

  return (
    <Center sx={{ width: "100vw", marginTop: 10 }}>
      <Title as="h1">370🅙 Media Commons {title} Reservation Form</Title>
      <Modal padding={4}>
        <Box width="100%">
          <AlertHeader color="info" icon={<Description />}>
            Policy Reminders
          </AlertHeader>
        </Box>
        {isVIP ? (
          <>
            <div style={{ marginTop: 3 }}>
              <Bulleted>
                <ListItem>
                  Enter booking details for the VIP's or Community Partners.
                </ListItem>
                <ListItem>
                  No approval process is required for these bookings.
                </ListItem>
                <ListItem>
                  The booking will be linked by the individual’s netID and will
                  appears on the their dashboard and Google Calendar.
                </ListItem>
              </Bulleted>
            </div>
          </>
        ) : (
          <>
            <Typography fontWeight={700} marginTop={3}>
              Audio Lab (230) has different hours for Walk-Ins
            </Typography>
            <Bulleted>
              <ListItem>
                M-F 10am - 6pm staffed hours (audio engineer on site)
              </ListItem>
              <ListItem>
                M-F 6pm - 9pm playback hours (no staff, multichannel speakers
                and RME)
              </ListItem>
              <ListItem>
                Sa 11am - 6pm playback hours (no staff, multichannel speakers
                and RME)
              </ListItem>
            </Bulleted>
          </>
        )}
        <Button
          variant="contained"
          color="primary"
          onClick={() =>
            router.push(isVIP ? `/${tenant}/vip/role` : `/${tenant}/walk-in/role`)
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
