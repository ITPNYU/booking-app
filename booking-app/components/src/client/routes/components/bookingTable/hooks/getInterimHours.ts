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
    if (ts && typeof ts.toDate === "function") {
      const ms = ts.toDate().getTime();
      if (ms > latestMs) latestMs = ms;
    }
  }
  return latestMs;
}

export function getInterimHours(row: BookingRow): number | null {
  const latestMs = getLatestStatusChangeMs(row);
  if (latestMs === 0) return null;
<<<<<<< HEAD
  return Math.max(0, (Date.now() - latestMs) / (1000 * 60 * 60));
=======
  const elapsedMs = Math.max(0, Date.now() - latestMs);
  return elapsedMs / (1000 * 60 * 60);
>>>>>>> 0279ccd9854d5ac808942e8d6db57db2120b0138
}
