import { Alert, AlertColor, Box, Button, Tooltip } from "@mui/material";
import { Check, ChevronLeft, ChevronRight } from "@mui/icons-material";
import React, { useContext } from "react";

import { BookingContext } from "../bookingProvider";
import Grid from "@mui/material/Unstable_Grid2";
import useCalculateOverlap from "../hooks/useCalculateOverlap";
import useCheckAutoApproval from "../hooks/useCheckAutoApproval";
import { usePathname } from "next/navigation";

interface Props {
  goBack: () => void;
  goNext: () => void;
  hideBackButton: boolean;
  hideNextButton: boolean;
}

export default function BookingStatusBar(props: Props) {
  const pathname = usePathname();
  const isWalkIn = pathname.includes("/walk-in");
  const { isAutoApproval, errorMessage } = useCheckAutoApproval(isWalkIn);
  const { bookingCalendarInfo, selectedRooms, isBanned, needsSafetyTraining } =
    useContext(BookingContext);
  const isOverlap = useCalculateOverlap();

  const showAlert =
    isBanned ||
    needsSafetyTraining ||
    (bookingCalendarInfo != null &&
      selectedRooms.length > 0 &&
      !pathname.includes("/modification"));

  // order of precedence matters
  // unfixable blockers > fixable blockers > non-blockers
  const state: {
    message: React.ReactNode;
    severity: AlertColor;
    icon?: React.ReactNode;
    variant?: "filled" | "standard" | "outlined";
    btnDisabled: boolean;
    btnDisabledMessage?: string;
  } = (() => {
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
            one of the rooms you have selected
          </p>
        ),
        severity: "error",
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
    if (isAutoApproval)
      return {
        btnDisabled: false,
        btnDisabledMessage: null,
        message: <p>Yay! This request is eligible for automatic approval</p>,
        severity: "success",
        icon: <Check fontSize="inherit" />,
      };

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
  })();

  const [disabled, disabledMessage] = (() => {
    if (state.btnDisabled) {
      return [true, state.btnDisabledMessage];
    }
    if (bookingCalendarInfo == null) {
      return [true, "Click and drag on the calendar to select a time slot"];
    }
    return [false, ""];
  })();

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Grid
        container
        sx={{ alignItems: "center" }}
        paddingLeft="24px"
        paddingRight="18px"
      >
        <Grid xs={"auto"}>
          {!props.hideBackButton && (
            <Button
              variant="outlined"
              startIcon={<ChevronLeft />}
              onClick={props.goBack}
            >
              Back
            </Button>
          )}
        </Grid>
        <Grid md={10} xs={"auto"}>
          {showAlert && (
            <Alert
              severity={state.severity}
              icon={state.icon}
              variant={state.variant ?? "filled"}
              sx={{ padding: "0px 16px", margin: "0px 12px", width: "100%" }}
            >
              {state.message}
            </Alert>
          )}
        </Grid>
        <Grid sx={{ marginLeft: "auto" }}>
          {!props.hideNextButton && (
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
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
