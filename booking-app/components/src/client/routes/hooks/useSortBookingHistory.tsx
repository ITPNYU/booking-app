import { TableNames } from "@/components/src/policy";
import {
  BookingLog,
  BookingRow,
  BookingStatusLabel,
} from "@/components/src/types";
import { resolvePreApprovedHistoryNotes } from "@/components/src/utils/bookingHistoryNotes";
import { clientFetchAllDataFromCollection } from "@/lib/firebase/firebase";
import {
  compareTimestampsAscending,
  timestampToDate,
} from "@/lib/utils/timestampWire";
import { TableCell, TableRow } from "@mui/material";
import { useEffect, useState } from "react";
import { formatHistoryDateTime } from "../../utils/date";
import StatusChip from "../components/bookingTable/StatusChip";

type HistoryRow = {
  status: BookingStatusLabel;
  user: string;
  time: unknown;
  note?: string;
};

const historyTimeLabel = (value: unknown, suffix = "") => {
  const instant = timestampToDate(value);
  if (!instant) return "";
  return `${formatHistoryDateTime(instant)}${suffix}`;
};

export default function useSortBookingHistory(booking: BookingRow) {
  const [rows, setRows] = useState<JSX.Element[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      const logs = await clientFetchAllDataFromCollection<BookingLog>(
        TableNames.BOOKING_LOGS,
        [{ field: "requestNumber", op: "==", value: booking.requestNumber }],
      );

      if (logs.length > 0) {
        // Use bookingLogs data if available
        const sortedLogs = [...logs].sort((a, b) =>
          compareTimestampsAscending(a.changedAt, b.changedAt),
        );
        const resolvedNotes = resolvePreApprovedHistoryNotes(sortedLogs);
        const sortedRows = sortedLogs.map((log, index) => {
          const note =
            log.status === BookingStatusLabel.MODIFIED
              ? `Modified by ${log.changedBy}`
              : resolvedNotes[index];
          return (
            <TableRow key={log.id}>
              <TableCell>
                <StatusChip status={log.status} />
              </TableCell>
              <TableCell>{log.changedBy}</TableCell>
              <TableCell>{historyTimeLabel(log.changedAt)}</TableCell>
              <TableCell>{note}</TableCell>
            </TableRow>
          );
        });
        setRows(sortedRows);
      } else {
        // Fallback to original implementation
        const data: HistoryRow[] = [];
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
          .sort((a, b) => compareTimestampsAscending(a.time, b.time))
          .map((row, index) => (
            <TableRow key={index}>
              <TableCell>
                <StatusChip status={row.status} />
              </TableCell>
              <TableCell>{row.user}</TableCell>
              <TableCell>{historyTimeLabel(row.time, " ET")}</TableCell>
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
