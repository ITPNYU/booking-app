"use client";

import { Box, Button, Typography, useTheme } from "@mui/material";
import { Error, Event } from "@mui/icons-material";
import React, { useContext, useEffect, useRef } from "react";
import { FormContextLevel, PagePermission } from "@/components/src/types";
import { canAccessWebCheckout, PERMISSION_PATH } from "@/components/src/utils/permissions";
import { styled } from "@mui/system";
import { useRouter, useParams } from "next/navigation";
import { BookingContext } from "../bookingProvider";
import { DatabaseContext } from "../../components/Provider";
import Loading from "../../components/Loading";
import {
  peekDashboardReturn,
  staffBookingsPath,
} from "../../components/bookingTable/dashboardView";

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
  const { pagePermission } = useContext(DatabaseContext);
  const router = useRouter();
  const { tenant } = useParams();
  const theme = useTheme();

  const isWalkIn = formContext === FormContextLevel.WALK_IN;
  const isVIP = formContext === FormContextLevel.VIP;
  const isMod = formContext === FormContextLevel.MODIFICATION;
  const redirected = useRef(false);
  const tenantId = String(tenant ?? "");
  const modificationReturn = isMod
    ? peekDashboardReturn("modification", tenantId)
    : null;
  const returnToDashboard =
    isMod && (modificationReturn != null || canAccessWebCheckout(pagePermission));

  const getModReturnPath = (): string => {
    const path = PERMISSION_PATH[pagePermission];
    return path ? `/${tenant}/${path}` : `/${tenant}`;
  };

  useEffect(() => {
    if (submitting !== "success" || !returnToDashboard || redirected.current) {
      return;
    }
    redirected.current = true;
    router.replace(
      modificationReturn ?? staffBookingsPath(tenantId, pagePermission),
    );
  }, [
    modificationReturn,
    pagePermission,
    returnToDashboard,
    router,
    submitting,
    tenantId,
  ]);

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
          Submitting {isWalkIn ? "walk-in" : isVIP ? "VIP" : "your booking"}{" "}
          request...
        </Typography>
      </Centered>
    );
  }

  if (submitting === "success" && returnToDashboard) {
    return (
      <Centered>
        <Loading />
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
            : isVIP
              ? "VIP request submitted"
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
            onClick={() =>
              router.push(
                isVIP
                  ? `/${tenant}/admin`
                  : isWalkIn
                    ? `/${tenant}/pa`
                    : isMod
                      ? (peekDashboardReturn("modification", tenantId) ??
                        getModReturnPath())
                      : (peekDashboardReturn("edit", tenantId) ?? `/${tenant}`),
              )
            }
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
  if (error || submitting === "error") {
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
          Sorry, an error occurred while submitting this request
        </Typography>
        <Typography variant="h6">{error?.message}</Typography>
      </Centered>
    );
  }

  return null;
}
