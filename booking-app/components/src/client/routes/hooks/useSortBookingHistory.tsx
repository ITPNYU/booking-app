import { BookingRow, BookingStatusLabel } from "@/components/src/types";
import { TableCell, TableRow } from "@mui/material";
import { formatDateTable, formatTimeAmPm } from "../../utils/date";

import { Timestamp } from "@firebase/firestore";
import { useMemo } from "react";
import StatusChip from "../components/bookingTable/StatusChip";

type HistoryRow = {
  status: BookingStatusLabel;
  user: string;
  time: Timestamp;
  note?: string;
};

export default function useSortBookingHistory(booking: BookingRow) {
  const rows = useMemo(() => {
    let data: HistoryRow[] = [];
    data.push({
      status: BookingStatusLabel.REQUESTED,
      user: booking.email,
      time: booking.requestedAt || booking.walkedInAt,
    });

    if (booking.finalApprovedAt) {
      data.push({
        status: BookingStatusLabel.APPROVED,
        user: booking.finalApprovedBy,
        time: booking.finalApprovedAt,
      });
    }
    if (booking.canceledAt) {
      data.push({
        status: BookingStatusLabel.CANCELED,
        user: booking.canceledBy,
        time: booking.canceledAt,
      });
    }
    if (booking.checkedInAt) {
      data.push({
        status: BookingStatusLabel.CHECKED_IN,
        user: booking.checkedInBy,
        time: booking.checkedInAt,
      });
    }
    if (booking.checkedOutAt) {
      data.push({
        status: BookingStatusLabel.CHECKED_OUT,
        user: booking.checkedOutBy,
        time: booking.checkedOutAt,
      });
    }
    if (booking.noShowedAt) {
      data.push({
        status: BookingStatusLabel.NO_SHOW,
        user: booking.noShowedBy,
        time: booking.noShowedAt,
      });
    }
    if (booking.firstApprovedAt) {
      data.push({
        status: BookingStatusLabel.PENDING,
        user: booking.firstApprovedBy,
        time: booking.firstApprovedAt,
      });
    }
    if (booking.declinedAt) {
      data.push({
        status: BookingStatusLabel.DECLINED,
        user: booking.declinedBy,
        time: booking.declinedAt,
        note: booking.declineReason,
      });
    }
    if (booking.walkedInAt) {
      data.push({
        status: BookingStatusLabel.WALK_IN,
        user: "PA",
        time: booking.walkedInAt,
      });
    }
    return data;
  }, [booking]);

  return rows
    .sort((a, b) => a.time.toMillis() - b.time.toMillis())
    .map((row, i) => (
      <TableRow key={i}>
        <TableCell>
          <StatusChip status={row.status} />
        </TableCell>
        <TableCell>{row.user}</TableCell>
        <TableCell>
          {formatDateTable(row.time.toDate())}{" "}
          {formatTimeAmPm(row.time.toDate())}
        </TableCell>
        <TableCell>{row.note}</TableCell>
      </TableRow>
    ));
}
