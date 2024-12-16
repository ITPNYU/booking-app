import { Booking } from "@/components/src/types";

export type DateRangeFilter = "Today" | "This Week" | "All Future" | "Past 24 hours" | "Past Week" | "Past Month" | "Past 6 Months" | "All Past";

export const DATE_FILTERS: Record<DateRangeFilter, (x: Booking) => boolean> = {
  Today: (row) => {
    const today = new Date();
    const date = row.startDate.toDate();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  },

  "This Week": (row) => {
    const today = new Date();
    let dayOfWeek = today.getDay();
    if (dayOfWeek === 0) {
      // sunday as last day of week
      dayOfWeek = 7;
    }

    // Calculate the start of the week (Monday)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - (dayOfWeek - 1));
    startOfWeek.setHours(0, 0, 0, 0);

    // Calculate the end of the week (Sunday)
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (7 - dayOfWeek));
    endOfWeek.setHours(23, 59, 59, 999);

    // Check if the given date is within the start and end of the week
    const date = row.startDate.toDate();
    return date >= startOfWeek && date <= endOfWeek;
  },
  
  "All Future": (row) => {
    const today = new Date();
    return row.startDate.toDate() >= today;
  },

  "Past 24 hours": (row) => {
    const today = new Date();
    const date = row.startDate.toDate();
    const diff = today.getTime() - date.getTime();

    // Check that the date is within the past 24 hours and not in the future
    return diff >= 0 && diff < 24 * 60 * 60 * 1000;
  },

  "Past Week": (row) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset today to midnight

    const date = row.startDate.toDate();
    const diff = today.getTime() - date.getTime();

    // Check that the date is within the past 7 days and not in the future
    return diff >= 0 && diff < 7 * 24 * 60 * 60 * 1000;
  },

  "Past Month": (row) => {
    const today = new Date();
    const date = row.startDate.toDate();
    const diff = today.getTime() - date.getTime();

    // Check that the date is within the past 30 days and not in the future
    return diff >= 0 && diff < 30 * 24 * 60 * 60 * 1000;
  },

  "Past 6 Months": (row) => {
    const today = new Date();
    const date = row.startDate.toDate();
    const diff = today.getTime() - date.getTime();

    // Check that the date is within the past 6 months and not in the future
    return diff >= 0 && diff < 6 * 30 * 24 * 60 * 60 * 1000;
  },

  "All Past": (row) => {
    const today = new Date();
    const date = row.startDate.toDate();

    // Check that the date is in the past (not in the future)
    return today.getTime() - date.getTime() >= 0;
  },
};
