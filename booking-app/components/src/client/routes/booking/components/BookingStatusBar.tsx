import { Check, ChevronLeft, ChevronRight, Info } from "@mui/icons-material";
import {
  Alert,
  AlertColor,
  Box,
  Button,
  Tooltip,
  useMediaQuery,
  useTheme,
  Typography,
} from "@mui/material";
import React, { useContext } from "react";

import { FormContextLevel } from "@/components/src/types";
import { styled } from "@mui/system";
import { BookingContext } from "../bookingProvider";
import useCalculateOverlap from "../hooks/useCalculateOverlap";
import useCheckAutoApproval from "../hooks/useCheckAutoApproval";

interface Props {
  formContext: FormContextLevel;
  goBack: () => void;
  goNext: () => void;
  hideBackButton: boolean;
  hideNextButton: boolean;
}

const NavGrid = styled(Box)`
  display: grid;
  grid-template-columns: 94px 1fr 94px;
  grid-gap: 12px;
  padding-left: 24px;
  padding-right: 18px;
`;

export default function BookingStatusBar({ formContext, ...props }: Props) {
  const isWalkIn = formContext === FormContextLevel.WALK_IN;
  const { isAutoApproval, errorMessage } = useCheckAutoApproval(isWalkIn);
  const {
    bookingCalendarInfo,
    selectedRooms,
    isBanned,
    needsSafetyTraining,
    isInBlackoutPeriod,
    role,
  } = useContext(BookingContext);
  const isOverlap = useCalculateOverlap();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const showAlert =
    isBanned ||
    needsSafetyTraining ||
    isInBlackoutPeriod ||
    (bookingCalendarInfo != null && selectedRooms.length > 0);

  // order of precedence matters
  // unfixable blockers > fixable blockers > non-blockers
  const state:
    | {
        message: React.ReactNode;
        severity: AlertColor;
        icon?: React.ReactNode;
        variant?: "filled" | "standard" | "outlined";
        btnDisabled: boolean;
        btnDisabledMessage?: string;
      }
    | undefined = (() => {
    if (isBanned)
      return {
        btnDisabled: true,
        btnDisabledMessage: "You are banned",
        message: <p>You are banned from booking with the Media Commons</p>,
        severity: "error",
        variant: "filled",
      };
    if (needsSafetyTraining)
      return {
        btnDisabled: true,
        btnDisabledMessage: "You need to take safety training",
        message: (
          <p>
            You have not taken safety training, which is required for at least
            one of the rooms you have selected.{" "}
            <a
              href="https://sites.google.com/nyu.edu/370jmediacommons/reservations/safety-training"
              target="_blank"
              rel="noopener noreferrer"
            >
              Sign up here
            </a>
          </p>
        ),
        severity: "error",
      };
    if (isInBlackoutPeriod)
      return {
        btnDisabled: true,
        btnDisabledMessage: "Selected date is within a blackout period",
        message: (
          <p>
            The selected date falls within a blackout period when bookings are
            not allowed. Please select a different date.
          </p>
        ),
        severity: "error",
        variant: "filled",
      };
    if (isOverlap)
      return {
        btnDisabled: true,
        btnDisabledMessage:
          "Select a different time slot that doesn't conflict with existing reservations",
        message: (
          <p>
            Your selection conflicts with at least one existing reservation.
            Please make another selection.
          </p>
        ),
        severity: "error",
      };
    if (isWalkIn && !isAutoApproval) {
      // walk-ins must be < 4 hours
      return {
        btnDisabled: true,
        btnDisabledMessage: errorMessage,
        message: <p>Walk-ins must be between 1-4 hours in duration</p>,
        severity: "error",
      };
    }
    if (isAutoApproval && formContext !== FormContextLevel.MODIFICATION)
      return {
        btnDisabled: false,
        btnDisabledMessage: null,
        message: <p>Yay! This request is eligible for automatic approval</p>,
        severity: "success",
        icon: <Check fontSize="inherit" />,
      };
    else if (formContext !== FormContextLevel.MODIFICATION)
      return {
        btnDisabled: false,
        btnDisabledMessage: null,
        message: (
          <p>
            This request will require approval.{" "}
            <Tooltip title={errorMessage}>
              <a>Why?</a>
            </Tooltip>
          </p>
        ),
        severity: "warning",
      };
    else {
      return undefined;
    }
  })();

  const [disabled, disabledMessage] = (() => {
    if (state?.btnDisabled ?? false) {
      return [true, state.btnDisabledMessage];
    }
    if (bookingCalendarInfo == null) {
      return [true, "Click and drag on the calendar to select a time slot"];
    }
    return [false, ""];
  })();

  const backBtn = !props.hideBackButton && (
    <Button
      variant="outlined"
      startIcon={<ChevronLeft />}
      onClick={props.goBack}
    >
      Back
    </Button>
  );

  const nextBtn = !props.hideNextButton && (
    <Tooltip title={disabledMessage}>
      <span>
        <Button
          variant="outlined"
          endIcon={<ChevronRight />}
          onClick={props.goNext}
          disabled={disabled}
        >
          Next
        </Button>
      </span>
    </Tooltip>
  );

  const alert = showAlert && state && (
    <Alert
      severity={state.severity}
      icon={state.icon}
      variant={state.variant ?? "filled"}
      sx={{ padding: "0px 16px", width: "100%" }}
    >
      {state.message}
    </Alert>
  );

  if (isMobile) {
    return (
      <Box>
        <NavGrid>
          <Box>{backBtn}</Box>
          <Box></Box>
          <Box>{nextBtn}</Box>
        </NavGrid>
        <Box sx={{ pr: "18px", pl: "24px", mt: 2 }}>{alert}</Box>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <NavGrid>
        <Box>{backBtn}</Box>
        <Box>
          {alert}
          <Alert
            severity="warning"
            variant="filled"
            sx={{ padding: "0px 16px", width: "100%", margin: "5px 0px" }}
          >
            Please include all setup and breakdown time in your reservation
            request.
          </Alert>
        </Box>
        <Box>{nextBtn}</Box>
      </NavGrid>
    </Box>
  );
}
