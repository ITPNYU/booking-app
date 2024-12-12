import { Booking, MediaServices } from "@/components/src/types";
import React, { useContext, useRef, useState } from "react";

import { DatabaseContext } from "../Provider";
import { Switch } from "@mui/material";
import { TableNames } from "@/components/src/policy";
import { clientUpdateDataByCalendarEventId } from "@/lib/firebase/client/clientDb";

interface Props {
  booking: Booking;
  status: boolean;
}

export default function EquipmentCheckoutToggle({ booking, status }: Props) {
  const [loading, setLoading] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState(status);
  const originalStatus = useRef(status);
  const { reloadFutureBookings } = useContext(DatabaseContext);

  const handleEquipToggleChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newStatus = event.target.checked;
    setOptimisticStatus(newStatus);
    setLoading(true);

    try {
      await clientUpdateDataByCalendarEventId(
        TableNames.BOOKING,
        booking.calendarEventId,
        {
          equipmentCheckedOut: newStatus,
        }
      );
      await reloadFutureBookings();
    } catch (ex) {
      console.error(ex);
      // Revert to the original status if there's an error
      setOptimisticStatus(originalStatus.current);
    } finally {
      setLoading(false);
    }
  };

  if (!booking.mediaServices?.includes(MediaServices.CHECKOUT_EQUIPMENT)) {
    return null;
  }

  return (
    <Switch
      checked={optimisticStatus}
      onChange={handleEquipToggleChange}
      inputProps={{ "aria-label": "controlled" }}
      sx={{ marginLeft: "-8px" }}
      disabled={loading}
    />
  );
}
