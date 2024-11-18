import React, { useContext, useRef, useState } from "react";
import { TableNamesRaw, Tenants, getTableName } from "@/components/src/policy";

import { BookingRowMediaCommons } from "@/components/src/typesMediaCommons";
import { MediaServices } from "@/components/src/types";
import { SharedDatabaseContext } from "../../../providers/SharedDatabaseProvider";
import { Switch } from "@mui/material";
import { clientUpdateDataByCalendarEventId } from "@/lib/firebase/client/clientDb";

interface Props {
  booking: BookingRowMediaCommons;
  status: boolean;
}

export default function EquipmentCheckoutToggle({ booking, status }: Props) {
  const [loading, setLoading] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState(status);
  const originalStatus = useRef(status);
  const { reloadBookings } = useContext(SharedDatabaseContext);

  const handleEquipToggleChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newStatus = event.target.checked;
    setOptimisticStatus(newStatus);
    setLoading(true);

    try {
      await clientUpdateDataByCalendarEventId(
        getTableName(TableNamesRaw.BOOKING, Tenants.MEDIA_COMMONS),
        booking.calendarEventId,
        {
          equipmentCheckedOut: newStatus,
        }
      );
      await reloadBookings();
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
