import React, { useMemo } from 'react';

import { BookingStatusLabel } from '../../../../types';
import Chip from '@mui/material/Chip';
import { styled } from '@mui/material';

interface Props {
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

export default function StatusChip({ status, disabled = false }: Props) {
  const color = useMemo(() => {
    if (disabled) {
      return 'rgba(0, 0, 0, 0.38)';
    }
    switch (status) {
      case BookingStatusLabel.APPROVED:
        return 'rgba(72, 196, 77, 1)';
      case BookingStatusLabel.CANCELED:
        return 'rgba(85,94,97,1)';
      case BookingStatusLabel.CHECKED_IN:
        return 'rgba(135, 52, 255, 1)';
      case BookingStatusLabel.NO_SHOW:
        return 'rgba(6, 180, 255, 1)';
      case BookingStatusLabel.PRE_APPROVED:
        return 'rgba(223, 26, 255, 1)';
      case BookingStatusLabel.REJECTED:
        return 'rgba(255, 26, 26, 1)';
      case BookingStatusLabel.REQUESTED:
        return 'rgba(255, 122, 26, 1)';
      case BookingStatusLabel.UNKNOWN:
        return 'rgba(85,94,97,1)';
    }
  }, [status, disabled]);

  const bgcolor = useMemo(() => {
    if (disabled) {
      return 'rgba(33, 33, 33, 0.08)';
    }
    switch (status) {
      case BookingStatusLabel.APPROVED:
        return 'rgba(72, 196, 77, 0.11)';
      case BookingStatusLabel.CANCELED:
        return 'rgba(47,47,46,0.11)';
      case BookingStatusLabel.CHECKED_IN:
        return 'rgba(127, 57, 251, 0.18)';
      case BookingStatusLabel.NO_SHOW:
        return 'rgba(6, 180, 255, 0.11)';
      case BookingStatusLabel.PRE_APPROVED:
        return 'rgba(223, 26, 255, 0.11)';
      case BookingStatusLabel.REJECTED:
        return 'rgba(255, 26, 26, 0.11)';
      case BookingStatusLabel.REQUESTED:
        return 'rgba(255, 122, 26, 0.11)';
      case BookingStatusLabel.UNKNOWN:
        return 'rgba(47,47,46,0.11)';
    }
  }, [status, disabled]);

  const text = useMemo(() => {
    switch (status) {
      case BookingStatusLabel.APPROVED:
        return 'Approved';
      case BookingStatusLabel.CANCELED:
        return 'Canceled';
      case BookingStatusLabel.CHECKED_IN:
        return 'Checked In';
      case BookingStatusLabel.NO_SHOW:
        return 'No Show';
      case BookingStatusLabel.PRE_APPROVED:
        return 'Pre-Approved';
      case BookingStatusLabel.REJECTED:
        return 'Declined';
      case BookingStatusLabel.REQUESTED:
        return 'Requested';
      case BookingStatusLabel.UNKNOWN:
        return 'Unknown';
    }
  }, [status]);

  return (
    <RectangleChip
      label={text}
      sx={{
        bgcolor,
        color,
        transition: 'background-color 150ms, color 150ms',
      }}
    />
  );
}
