import { BookingRow } from "@/components/src/types";

export type ColumnSortOrder = "asc" | "desc";

function getLatestStatusChangeMs(row: BookingRow): number {
  let latestMs = 0;
  const timestamps = [
    row.requestedAt,
    row.firstApprovedAt,
    row.finalApprovedAt,
    row.equipmentAt,
    row.equipmentApprovedAt,
    row.declinedAt,
    row.canceledAt,
    row.checkedInAt,
    row.checkedOutAt,
    row.noShowedAt,
    row.closedAt,
    row.walkedInAt,
  ];
  for (const ts of timestamps) {
    if (ts && typeof ts.toDate === "function") {
      const ms = ts.toDate().getTime();
      if (ms > latestMs) latestMs = ms;
    }
  }
  return latestMs;
}

export const COMPARATORS: {
  [property: string]: (a: BookingRow, b: BookingRow) => number;
} = {
  startDate: (a, b) =>
    a.startDate.toDate().getTime() - b.startDate.toDate().getTime(),
  department: (a, b) => a.department.localeCompare(b.department),
  netId: (a, b) => a.netId.localeCompare(b.netId),
  status: (a, b) => a.status.localeCompare(b.status),
  requestNumber: (a, b) => (a.requestNumber ?? 0) - (b.requestNumber ?? 0),
  interim: (a, b) => getLatestStatusChangeMs(a) - getLatestStatusChangeMs(b),
};
