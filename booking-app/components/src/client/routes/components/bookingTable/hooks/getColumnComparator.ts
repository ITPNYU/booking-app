import { BookingRow } from "@/components/src/types";

export type ColumnSortOrder = "asc" | "desc";

export const COMPARATORS: {
  [property: string]: (a: BookingRow, b: BookingRow) => number;
} = {
  startDate: (a, b) =>
    a.startDate.toDate().getTime() - b.startDate.toDate().getTime(),
  department: (a, b) => a.department.localeCompare(b.department),
  netId: (a, b) => a.netId.localeCompare(b.netId),
  status: (a, b) => a.status.localeCompare(b.status),
  requestNumber: (a, b) => (a.requestNumber ?? 0) - (b.requestNumber ?? 0),
};
