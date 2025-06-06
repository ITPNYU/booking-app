import { TableNames } from "@/components/src/policy";
import { BookingLog, BookingRow, BookingStatusLabel } from "@/components/src/types";
import { clientFetchAllDataFromCollection } from "@/lib/firebase/firebase";
import { TableCell, TableRow } from "@mui/material";
import { Timestamp, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { formatDateTable, formatTimeAmPm } from "../../utils/date";
import StatusChip from "../components/bookingTable/StatusChip";

type HistoryRow = {
  status: BookingStatusLabel;
  user: string;
  time: Timestamp;
  note?: string;
};

export default function useSortBookingHistory(booking: BookingRow) {
  const [rows, setRows] = useState<JSX.Element[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      const logs = await clientFetchAllDataFromCollection<BookingLog>(
        TableNames.BOOKING_LOGS,
        [where("requestNumber", "==", booking.requestNumber)]
      );

      if (logs.length > 0) {
        // Use bookingLogs data if available
        const sortedRows = logs
          .sort((a, b) => a.changedAt.toMillis() - b.changedAt.toMillis())
          .map((log) => (
            <TableRow key={log.id}>
              <TableCell>
                <StatusChip status={log.status} />
              </TableCell>
              <TableCell>{log.changedBy}</TableCell>
              <TableCell>
                {formatDateTable(log.changedAt.toDate())}{" "}
                {formatTimeAmPm(log.changedAt.toDate())}
              </TableCell>
              <TableCell>
                {log.status === BookingStatusLabel.MODIFIED
                  ? `Modified by ${log.changedBy}`
                  : log.note}
              </TableCell>
            </TableRow>
          ));
        setRows(sortedRows);
      } else {
        // Fallback to original implementation
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
        const sortedRows = data
          .sort((a, b) => a.time.toMillis() - b.time.toMillis())
          .map((row, index) => (
            <TableRow key={index}>
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
        setRows(sortedRows);
      }
    };
    fetchLogs();
  }, [booking]);

  return rows;
}
