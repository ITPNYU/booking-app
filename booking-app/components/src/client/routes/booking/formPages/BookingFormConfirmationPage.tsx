"use client";

import { Box, Button, Typography, useTheme } from "@mui/material";
import { Error, Event } from "@mui/icons-material";
import React, { useContext } from "react";

import { BookingContext } from "../bookingProvider";
import { FormContextLevel } from "@/components/src/types";
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

interface Props {
  formContext: FormContextLevel;
}

export default function BookingFormConfirmationPage({ formContext }: Props) {
  const { submitting, error } = useContext(BookingContext);
  const router = useRouter();
  const theme = useTheme();

  const isWalkIn = formContext === FormContextLevel.WALK_IN;

  // don't submit form via useEffect here b/c it submits twice in development strict mode

  if (submitting === "submitting") {
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
        <Typography variant="h6">
          Submitting {isWalkIn ? "walk-in" : "your booking"} request...
        </Typography>
      </Centered>
    );
  }

  if (submitting === "error") {
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
          <Typography variant="h3" style={{ fontSize: "2rem", marginBottom: "1rem" }}>
            ⚠️
          </Typography>
        </Box>
        <Typography variant="h6" sx={{ padding: 3, textAlign: "center" }}>
          An error occurred while submitting your request.
          <br />
          {error?.message}
          <br />
          Please try again.
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
            onClick={() => router.push(isWalkIn ? "/walk-in/selectRoom" : "/book/selectRoom")}
            variant="text"
            sx={{
              background: theme.palette.primary[50],
              color: theme.palette.primary.main,
            }}
          >
            Try Again
          </Button>
        </Box>
      </Centered>
    );
  }

  if (submitting === "success") {
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
          {isWalkIn
            ? "Walk-in submitted"
            : "Yay! We've received your booking request"}
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
            onClick={() => router.push(isWalkIn ? "/pa" : "/")}
            variant="text"
            sx={{
              background: theme.palette.primary[50],
              color: theme.palette.primary.main,
            }}
          >
            <Event />
            View Bookings
          </Button>
        </Box>
      </Centered>
    );
  }

  // TODO error state
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
        <Error />
      </Box>
      <Typography variant="h6">
        Sorry, an error occured while submitting this request
      </Typography>
    </Centered>
  );
}
