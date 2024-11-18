import { Booking } from "../../types";
import { Timestamp } from "firebase/firestore";
import { format } from "date-fns";

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

  // Round up to next half-hour or hour
  const roundedMinutes = minutes > 30 ? 60 : 30;

  if (roundedMinutes === 60) {
    now.setHours(now.getHours() + 1);
    now.setMinutes(0);
  } else {
    now.setMinutes(30);
  }

  now.setSeconds(0);
  now.setMilliseconds(0);

  return now;
}

export const typeGuard = (booking: Booking, key: string) => {
  if (key in booking) {
    return booking[key] as Timestamp;
  }
  return undefined;
};
