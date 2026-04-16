import { BookingRow } from "@/components/src/types";

const STATUS_TIMESTAMP_FIELDS = [
  "requestedAt",
  "firstApprovedAt",
  "finalApprovedAt",
  "equipmentAt",
  "equipmentApprovedAt",
  "declinedAt",
  "canceledAt",
  "checkedInAt",
  "checkedOutAt",
  "noShowedAt",
  "closedAt",
  "walkedInAt",
] as const;

export function getLatestStatusChangeMs(row: BookingRow): number {
  let latestMs = 0;
  for (const field of STATUS_TIMESTAMP_FIELDS) {
    const ts = row[field];
    let ms: number | null = null;
    if (ts instanceof Date) {
      ms = ts.getTime();
    } else if (ts && typeof (ts as any).toDate === "function") {
      ms = (ts as any).toDate().getTime();
    }
    if (ms !== null && ms > latestMs) latestMs = ms;
  }
  return latestMs;
}

export function getInterimHours(row: BookingRow): number | null {
  const latestMs = getLatestStatusChangeMs(row);
  if (latestMs === 0) return null;
  return Math.max(0, (Date.now() - latestMs) / (1000 * 60 * 60));
}
