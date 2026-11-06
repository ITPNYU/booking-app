import { ContentCopy, Undo } from "@mui/icons-material";
import { Button, Tooltip } from "@mui/material";
import { useParams } from "next/navigation";
import { useContext, useEffect, useState } from "react";

import { getPaginatedData } from "@/lib/firebase/firebase";
import { DEFAULT_TENANT } from "../../../../constants/tenants";
import { TableNames } from "../../../../policy";
import { Booking } from "../../../../types";
import { DatabaseContext } from "../../components/Provider";
import {
  describeBooking,
  pickLastBookingForRooms,
} from "../utils/copyFromBooking";

/** How many of the requester's bookings are searched for one in these rooms. */
const RECENT_BOOKINGS_LIMIT = 20;

/**
 * The requester's most recent booking that included any of the given rooms,
 * or null while loading, when there is none, or when the lookup fails.
 */
export function useLastBookingForRooms(
  roomIds: string[],
  enabled: boolean,
): Booking | null {
  const { userEmail } = useContext(DatabaseContext);
  const params = useParams();
  const tenant = (params?.tenant as string) || DEFAULT_TENANT;
  const roomKey = roomIds.join(",");
  const [found, setFound] = useState<{
    roomKey: string;
    booking: Booking | null;
  } | null>(null);

  useEffect(() => {
    if (!enabled || !userEmail || !roomKey) return;
    let cancelled = false;
    getPaginatedData<Booking>(
      TableNames.BOOKING,
      RECENT_BOOKINGS_LIMIT,
      { dateRange: "", sortField: "startDate", userEmail },
      null,
      tenant,
    )
      .then((bookings) => {
        if (!cancelled) {
          setFound({
            roomKey,
            booking: pickLastBookingForRooms(bookings, roomKey.split(",")),
          });
        }
      })
      .catch(() => {
        // Autofill is a convenience: without it the form is filled by hand.
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, userEmail, roomKey, tenant]);

  return enabled && found?.roomKey === roomKey ? found.booking : null;
}

/**
 * Section-header action. Fills the section from the last booking in these
 * rooms, then turns into Undo, which restores the section as it was before.
 */
export function AutofillButton({
  source,
  filled,
  onFill,
  onUndo,
}: {
  source: Booking;
  filled: boolean;
  onFill: () => void;
  onUndo: () => void;
}) {
  if (filled) {
    return (
      <Button
        size="small"
        startIcon={<Undo fontSize="small" />}
        onClick={onUndo}
        sx={{ textTransform: "none" }}
      >
        Undo autofill
      </Button>
    );
  }
  return (
    <Tooltip title={`From your last booking here: ${describeBooking(source)}`}>
      <Button
        size="small"
        startIcon={<ContentCopy fontSize="small" />}
        onClick={onFill}
        sx={{ textTransform: "none" }}
      >
        Autofill last time
      </Button>
    </Tooltip>
  );
}
