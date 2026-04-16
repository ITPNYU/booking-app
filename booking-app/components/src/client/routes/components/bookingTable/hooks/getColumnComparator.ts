import { BookingRow } from "@/components/src/types";
import { getInterimHours } from "./getInterimHours";

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
  interim: (a, b) => {
    const aHours = getInterimHours(a);
    const bHours = getInterimHours(b);
    if (aHours == null && bHours == null) return 0;
    if (aHours == null) return 1;
    if (bHours == null) return -1;
    return aHours - bHours;
  },
};
