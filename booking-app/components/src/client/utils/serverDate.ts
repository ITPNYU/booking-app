import { Timestamp } from "firebase-admin/firestore";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

type DateInput = Date | Timestamp | { [key: string]: any } | number | string;

const parseTimestamp = (value: DateInput): Timestamp => {
  if (value instanceof Timestamp) return value;
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (typeof value === "object" && value !== null) {
    const seconds = Number(value.seconds || value._seconds || 0);
    const nanoseconds = Number(value.nanoseconds || value._nanoseconds || 0);
    return new Timestamp(seconds, nanoseconds);
  }
  return Timestamp.fromDate(new Date(value.toString()));
};

export const serverFormatDate = (
  input: DateInput,
  timeZone: string = "America/New_York"
): string => {
  if (!input) return "";
  try {
    const timestamp = parseTimestamp(input);
    const utcDate = timestamp.toDate();
    const zonedDate = toZonedTime(utcDate, timeZone);
    const formattedResult = format(zonedDate, "yyyy-MM-dd hh:mm a");

    return formattedResult;
  } catch (error) {
    console.error("Error formatting date:", error, "Input:", input);
    return "";
  }
};
export const toFirebaseTimestamp = (date: Date | string | number): Timestamp =>
  parseTimestamp(date);

export const toFirebaseTimestampFromString = (
  dateString: string
): Timestamp => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error("Invalid date string");
    }
    return Timestamp.fromDate(date);
  } catch (error) {
    console.error(
      "Error converting string to Timestamp:",
      error,
      "Input:",
      dateString
    );
    throw error;
  }
};
