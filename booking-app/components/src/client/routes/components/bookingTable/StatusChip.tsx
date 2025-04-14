import React, { useMemo } from "react";
import { Tooltip, styled } from "@mui/material";

import { BookingStatusLabel } from "../../../../types";
import Chip from "@mui/material/Chip";

interface Props {
  allowTooltip?: boolean;
  disabled?: boolean;
  status: BookingStatusLabel;
}

const RectangleChip = styled(Chip)({
  borderRadius: 4,
  height: 24,
  span: {
    padding: 6,
    fontWeight: 500,
  },
});

export default function StatusChip({
  status,
  disabled = false,
  allowTooltip = false,
}: Props) {
  const color = useMemo(() => {
    if (disabled) {
      return "rgba(0, 0, 0, 0.38)";
    }
    switch (status) {
      case BookingStatusLabel.APPROVED:
        return "rgba(72, 196, 77, 1)";
      case BookingStatusLabel.CANCELED:
        return "rgba(85,94,97,1)";
      case BookingStatusLabel.CHECKED_IN:
        return "rgba(135, 52, 255, 1)";
      case BookingStatusLabel.CHECKED_OUT:
        return "rgba(142, 115, 180, 1)";
      case BookingStatusLabel.NO_SHOW:
        return "rgba(6, 180, 255, 1)";
      case BookingStatusLabel.PENDING:
        return "rgba(223, 26, 255, 1)";
      case BookingStatusLabel.DECLINED:
        return "rgba(255, 26, 26, 1)";
      case BookingStatusLabel.REQUESTED:
        return "rgba(255, 122, 26, 1)";
      case BookingStatusLabel.UNKNOWN:
        return "rgba(85,94,97,1)";
    }
  }, [status, disabled]);

  const bgcolor = useMemo(() => {
    if (disabled) {
      return "rgba(33, 33, 33, 0.08)";
    }
    switch (status) {
      case BookingStatusLabel.APPROVED:
        return "rgba(72, 196, 77, 0.11)";
      case BookingStatusLabel.CANCELED:
        return "rgba(47,47,46,0.11)";
      case BookingStatusLabel.CHECKED_IN:
        return "rgba(127, 57, 251, 0.18)";
      case BookingStatusLabel.CHECKED_OUT:
        return "rgba(155, 136, 186, 0.18)";
      case BookingStatusLabel.NO_SHOW:
        return "rgba(6, 180, 255, 0.11)";
      case BookingStatusLabel.PENDING:
        return "rgba(223, 26, 255, 0.11)";
      case BookingStatusLabel.DECLINED:
        return "rgba(255, 26, 26, 0.11)";
      case BookingStatusLabel.REQUESTED:
        return "rgba(255, 122, 26, 0.11)";
      case BookingStatusLabel.UNKNOWN:
        return "rgba(47,47,46,0.11)";
    }
  }, [status, disabled]);

  const text = useMemo(() => {
    switch (status) {
      case BookingStatusLabel.APPROVED:
        return "Approved";
      case BookingStatusLabel.CANCELED:
        return "Canceled";
      case BookingStatusLabel.CHECKED_IN:
        return "Checked In";
      case BookingStatusLabel.CHECKED_OUT:
        return "Checked Out";
      case BookingStatusLabel.NO_SHOW:
        return "No Show";
      case BookingStatusLabel.PENDING:
        return "Pending";
      case BookingStatusLabel.DECLINED:
        return "Declined";
      case BookingStatusLabel.REQUESTED:
        return "Requested";
      case BookingStatusLabel.UNKNOWN:
        return "Unknown";
    }
  }, [status]);

  const tooltipText = useMemo(() => {
    switch (status) {
      case BookingStatusLabel.APPROVED:
        return "Your request has been approved!";
      case BookingStatusLabel.CANCELED:
        return "Your request has been canceled.";
      case BookingStatusLabel.CHECKED_IN:
        return "Your reservation has begun, thank you for checking in at the front desk.";
      case BookingStatusLabel.CHECKED_OUT:
        return "Your reservation has ended.";
      case BookingStatusLabel.NO_SHOW:
        return "Your reservation has been cancelled as you did not check in on time.";
      case BookingStatusLabel.PENDING:
        return "Your request has been partially approved, still pending final approval.";
      case BookingStatusLabel.DECLINED:
        return "Your request has been declined.";
      case BookingStatusLabel.REQUESTED:
        return "Your request has been received and is pending approval.";
      case BookingStatusLabel.UNKNOWN:
        return "Unable to determine the status of this request.";
    }
  }, [status]);

  const chip = (
    <RectangleChip
      label={text}
      sx={{
        bgcolor,
        color,
        transition: "background-color 150ms, color 150ms",
      }}
    />
  );

  if (!allowTooltip) return chip;
  return (
    <Tooltip title={tooltipText} placement="right">
      {chip}
    </Tooltip>
  );
}
