import { format, toZonedTime } from "date-fns-tz";
import { Timestamp } from "firebase-admin/firestore";

type DateInput = Date | Timestamp | { [key: string]: any } | number | string;

export const parseTimestamp = (value: DateInput): Timestamp => {
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
  input: string,
  timeZone: string = "America/New_York"
): string => {
  if (!input) return "";
  try {
    const timestamp = parseTimestamp(input);
    const date = new Date(timestamp.toDate());
    const zonedDate = toZonedTime(date, timeZone);

    const formattedResult = format(zonedDate, "yyyy-MM-dd hh:mm a", {
      timeZone,
    });

    return formattedResult;
  } catch (error) {
    console.error("Error formatting date:", error, "Input:", input);
    return "";
  }
};

export const serverFormatDateOnly = (
  input: string,
  timeZone: string = "America/New_York"
): string => {
  if (!input) return "";
  try {
    const timestamp = parseTimestamp(input);
    const date = new Date(timestamp.toDate());
    const zonedDate = toZonedTime(date, timeZone);

    const formattedResult = format(zonedDate, "M/d/yyyy", {
      timeZone,
    });

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
