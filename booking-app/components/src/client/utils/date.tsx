import { Timestamp } from "firebase/firestore";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { DEFAULT_SLOT_UNIT } from "../routes/booking/utils/getSlotUnit";

// All times in the booking app are displayed in Eastern Time
export const TIMEZONE = "America/New_York";

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

  // Convert to Eastern Time before formatting
  const zonedDate = toZonedTime(date, TIMEZONE);
  return format(zonedDate, "yyyy-MM-dd h:mm a");
};

export const formatDateTable = (date: Date) => {
  // Convert to Eastern Time before extracting date components
  const zonedDate = toZonedTime(date, TIMEZONE);
  const month = (zonedDate.getMonth() + 1).toString().padStart(2, "0");
  const day = zonedDate.getDate().toString().padStart(2, "0");
  const year = zonedDate.getFullYear().toString().slice(-2);

  return `${month}/${day}/${year}`;
};

export const formatTimeTable = (date: Date) => {
  // Convert to Eastern Time before extracting time components
  const zonedDate = toZonedTime(date, TIMEZONE);
  let hours = zonedDate.getHours();
  const minutes = zonedDate.getMinutes().toString().padStart(2, "0");

  // Convert 24-hour format to 12-hour format
  hours = hours % 12;
  hours = hours ? hours : 12;

  return `${hours}:${minutes}`;
};

export const formatTimeAmPm = (d: Date) => {
  // Convert to Eastern Time and format with AM/PM
  const zonedDate = toZonedTime(d, TIMEZONE);
  return format(zonedDate, "h:mm a");
};

export function roundTimeUp(slotUnit: number = DEFAULT_SLOT_UNIT) {
  // Get current time in Eastern timezone
  const now = new Date();
  const easternNow = toZonedTime(now, TIMEZONE);
  const minutes = easternNow.getMinutes();

  const remainder = minutes % slotUnit;

  if (remainder === 0) {
    // already aligned to slot boundary
    easternNow.setSeconds(0);
    easternNow.setMilliseconds(0);
    return easternNow;
  }

  const roundedMinutes = minutes + (slotUnit - remainder);
  const hourIncrement = Math.floor(roundedMinutes / 60);
  const finalMinutes = roundedMinutes % 60;

  easternNow.setHours(easternNow.getHours() + hourIncrement);
  easternNow.setMinutes(finalMinutes);

  easternNow.setSeconds(0);
  easternNow.setMilliseconds(0);

  return easternNow;
}
