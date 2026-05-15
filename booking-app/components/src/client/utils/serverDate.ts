import { format, toZonedTime } from "date-fns-tz";
import { Timestamp } from "firebase-admin/firestore";
import { extractSecondsNanos } from "@/lib/utils/timestampWire";
import { TIMEZONE } from "./date";

type DateInput = Date | Timestamp | { [key: string]: any } | number | string;

const parseTimestamp = (value: DateInput): Timestamp => {
  if (value instanceof Timestamp) return value;
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (typeof value === "object" && value !== null) {
    const sn = extractSecondsNanos(value);
    if (sn !== null) return new Timestamp(sn.seconds, sn.nanoseconds);
    return new Timestamp(0, 0);
  }
  return Timestamp.fromDate(new Date(value.toString()));
};

export const serverFormatDate = (
  input: string,
  timeZone: string = TIMEZONE,
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
  timeZone: string = TIMEZONE,
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
  dateString: string,
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
      dateString,
    );
    throw error;
  }
};
