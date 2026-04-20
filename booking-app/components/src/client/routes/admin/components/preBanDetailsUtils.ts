import { Timestamp } from "firebase/firestore";
import { PreBanLog } from "../../../../types";

export type DetailSortColumn =
  | "date"
  | "status"
  | "requestNumber"
  | "excused";

export interface PreBanDetails {
  date: string;
  eventTimeMs: number;
  status: "Late Cancel" | "No Show";
  id: string;
  bookingId: string;
  excused: boolean;
}

export function preBanEventMillis(log: PreBanLog): number {
  const t = log.lateCancelDate ?? log.noShowDate;
  if (!t) return 0;
  return t instanceof Timestamp
    ? t.toMillis()
    : new Timestamp(
        (t as { seconds: number }).seconds,
        (t as { nanoseconds: number }).nanoseconds ?? 0,
      ).toMillis();
}

export function comparePreBanDetails(
  a: PreBanDetails,
  b: PreBanDetails,
  column: DetailSortColumn,
  order: "asc" | "desc",
  requestNumberByBookingId: Record<string, number | undefined>,
): number {
  const dir = order === "asc" ? 1 : -1;
  let cmp = 0;
  switch (column) {
    case "date":
      cmp = a.eventTimeMs - b.eventTimeMs;
      break;
    case "status":
      cmp = a.status.localeCompare(b.status);
      break;
    case "requestNumber": {
      const na = requestNumberByBookingId[a.bookingId];
      const nb = requestNumberByBookingId[b.bookingId];
      const va = na ?? Number.MAX_SAFE_INTEGER;
      const vb = nb ?? Number.MAX_SAFE_INTEGER;
      cmp = va - vb;
      break;
    }
    case "excused":
      cmp = Number(a.excused) - Number(b.excused);
      break;
    default:
      break;
  }
  if (cmp === 0) return 0;
  return cmp * dir;
}
