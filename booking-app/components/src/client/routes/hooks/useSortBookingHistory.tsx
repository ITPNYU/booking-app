import { BookingRow, BookingStatusLabel } from "@/components/src/types";
import { TableCell, TableRow } from "@mui/material";
import { formatDateTable, formatTimeAmPm, typeGuard } from "../../utils/date";

import StatusChip from "../components/bookingTable/StatusChip";
import { Timestamp } from "@firebase/firestore";
import { useMemo } from "react";

type HistoryRow = {
  status: BookingStatusLabel;
  user: string;
  time: Timestamp;
  note?: string;
};

export default function useSortBookingHistory(booking: BookingRow) {
  const typeGuardActionBy = (key: string) => {
    if (key in booking) {
      return booking[key];
    }
    return "";
  };

  const rows = useMemo(() => {
    let data: HistoryRow[] = [];
    data.push({
      status: BookingStatusLabel.REQUESTED,
      user: booking.email,
      time: booking.requestedAt,
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
    if (typeGuard(booking, "checkedInAt")) {
      data.push({
        status: BookingStatusLabel.CHECKED_IN,
        user: typeGuardActionBy("checkedInBy"),
        time: typeGuard(booking, "checkedInAt"),
      });
    }
    if (typeGuard(booking, "checkedOutAt")) {
      data.push({
        status: BookingStatusLabel.CHECKED_OUT,
        user: typeGuardActionBy("checkedOutAt"),
        time: typeGuard(booking, "checkedOutAt"),
      });
    }
    if (typeGuard(booking, "noShowedAt")) {
      data.push({
        status: BookingStatusLabel.NO_SHOW,
        user: typeGuardActionBy("noShowedBy"),
        time: typeGuard(booking, "noShowedAt"),
      });
    }
    if (typeGuard(booking, "firstApprovedAt")) {
      data.push({
        status: BookingStatusLabel.PENDING,
        user: typeGuardActionBy("firstApprovedBy"),
        time: typeGuard(booking, "firstApprovedAt"),
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
    if (typeGuard(booking, "walkedInAt")) {
      data.push({
        status: BookingStatusLabel.WALK_IN,
        user: "",
        time: typeGuard(booking, "walkedInAt"),
      });
    }
    return data;
  }, [booking, status]);

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
