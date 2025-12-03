import { Timestamp } from "firebase/firestore";
import { format } from "date-fns";
import { SLOT_UNIT } from "@/components/src/client/constants/slotUnit";

export const formatDate = (
  oldDate:
    | Date
    | Timestamp
    | { seconds: number; nanoseconds: number }
    | number
    | string
) => {
  if (!oldDate) return "";

  let date: Date;

  if (oldDate instanceof Date) {
    date = oldDate;
  } else if (oldDate instanceof Timestamp) {
    date = oldDate.toDate();
  } else if (
    typeof oldDate === "object" &&
    "seconds" in oldDate &&
    "nanoseconds" in oldDate
  ) {
    date = new Timestamp(oldDate.seconds, oldDate.nanoseconds).toDate();
  } else {
    date = new Date(oldDate);
  }

  return format(date, "yyyy-MM-dd hh:mm a");
};

export const formatDateTable = (date: Date) => {
  // const date = new Date(d);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const year = date.getFullYear().toString().slice(-2);

  return `${month}/${day}/${year}`;
};

export const formatTimeTable = (date: Date) => {
  // const date = new Date(d);
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");

  // Convert 24-hour format to 12-hour format
  hours = hours % 12;
  hours = hours ? hours : 12;

  return `${hours}:${minutes}`;
};

export const formatTimeAmPm = (d: Date) => {
  return new Date(d).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });
};

export function roundTimeUp() {
  const now = new Date();
  const minutes = now.getMinutes();

  const remainder = minutes % SLOT_UNIT;

  if (remainder === 0) {
    // already aligned to slot boundary
    now.setSeconds(0);
    now.setMilliseconds(0);
    return now;
  }

  const roundedMinutes = minutes + (SLOT_UNIT - remainder);

  if (roundedMinutes >= 60) {
    now.setHours(now.getHours() + 1);
    now.setMinutes(0);
  } else {
    now.setMinutes(roundedMinutes);
  }

  now.setSeconds(0);
  now.setMilliseconds(0);

  return now;
}
