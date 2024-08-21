import { Booking, MediaServices } from "@/components/src/types";
import React, { useContext, useState } from "react";

import { DatabaseContext } from "../Provider";
import { Switch } from "@mui/material";
import { TableNames } from "@/components/src/policy";
import { updateDataByCalendarEventId } from "@/components/src/server/admin";

interface Props {
  booking: Booking;
  status: boolean;
  setOptimisticEquipStatus: (x: boolean) => void;
}

export default function EquipmentCheckoutToggle({
  booking,
  status,
  setOptimisticEquipStatus,
}: Props) {
  const [loading, setLoading] = useState(false);
  const { reloadBookings } = useContext(DatabaseContext);

  const handleEquipToggleChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setLoading(true);
    setOptimisticEquipStatus(event.target.checked);

    try {
      await updateDataByCalendarEventId(
        TableNames.BOOKING,
        booking.calendarEventId,
        {
          equipmentCheckedOut: event.target.checked,
        }
      );
    } catch (ex) {
      console.error(ex);
      setOptimisticEquipStatus(undefined);
      console.error(ex);
    } finally {
      await reloadBookings();
      setOptimisticEquipStatus(undefined);
      //  setSelectedAction(Actions.PLACEHOLDER);
      setLoading(false);
    }
  };

  if (!booking.mediaServices.includes(MediaServices.CHECKOUT_EQUIPMENT)) {
    return null;
  }

  return (
    <Switch
      checked={status}
      onChange={handleEquipToggleChange}
      inputProps={{ "aria-label": "controlled" }}
      sx={{ marginLeft: "-8px" }}
      disabled={loading}
    />
  );
}
