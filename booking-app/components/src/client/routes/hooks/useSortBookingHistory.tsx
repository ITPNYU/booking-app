import { BookingRow, BookingStatusLabel } from "@/components/src/types";
import { TableCell, TableRow } from "@mui/material";
import { formatDateTable, formatTimeAmPm } from "../../utils/date";
import { useContext, useMemo } from "react";

import { DatabaseContext } from "../components/Provider";
import StatusChip from "../components/bookingTable/StatusChip";
import { Timestamp } from "@firebase/firestore";

type HistoryRow = {
  status: BookingStatusLabel;
  user: string;
  time: Timestamp;
  note?: string;
};

export default function useSortBookingHistory(booking: BookingRow) {
  const { bookingStatuses } = useContext(DatabaseContext);
  const status = bookingStatuses.filter(
    (row) => row.calendarEventId === booking.calendarEventId
  )[0];

  const rows = useMemo(() => {
    let data: HistoryRow[] = [];
    data.push({
      status: BookingStatusLabel.REQUESTED,
      user: status.email,
      time: status.requestedAt,
    });

    if (status.finalApprovedAt) {
      data.push({
        status: BookingStatusLabel.APPROVED,
        user: status.finalApprovedBy,
        time: status.finalApprovedAt,
      });
    }
    if (status.canceledAt) {
      data.push({
        status: BookingStatusLabel.CANCELED,
        user: status.canceledBy,
        time: status.canceledAt,
      });
    }
    if (status.checkedInAt) {
      data.push({
        status: BookingStatusLabel.CHECKED_IN,
        user: status.checkedInBy,
        time: status.checkedInAt,
      });
    }
    if (status.checkedOutAt) {
      data.push({
        status: BookingStatusLabel.CHECKED_OUT,
        user: status.checkedOutBy,
        time: status.checkedOutAt,
      });
    }
    if (status.noShowedAt) {
      data.push({
        status: BookingStatusLabel.NO_SHOW,
        user: status.noShowedBy,
        time: status.noShowedAt,
      });
    }
    if (status.firstApprovedAt) {
      data.push({
        status: BookingStatusLabel.PENDING,
        user: status.firstApprovedBy,
        time: status.firstApprovedAt,
      });
    }
    if (status.declinedAt) {
      data.push({
        status: BookingStatusLabel.DECLINED,
        user: status.declinedBy,
        time: status.declinedAt,
        note: status.declineReason,
      });
    }
    if (status.walkedInAt) {
      data.push({
        status: BookingStatusLabel.WALK_IN,
        user: "",
        time: status.walkedInAt,
      });
    }
    return data;
  }, [booking, status]);

  return rows
    .sort((a, b) => b.time.toMillis() - a.time.toMillis())
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
