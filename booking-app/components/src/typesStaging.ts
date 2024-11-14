import { BookingFormDetails, BookingRow, BookingStatus, Inputs } from "./types";

import { Timestamp } from "@firebase/firestore";

export type BookingStaging = InputsStaging &
  BookingStatusStaging & {
    calendarEventId: string;
    email: string;
    startDate: Timestamp;
    endDate: Timestamp;
    roomId: string;
    requestNumber: number;
  };

export type BookingStatusStaging = BookingStatus;

export type BookingFormDetailsStaging = BookingStaging & BookingFormDetails;

// used for Booking table rows that show status
export type BookingRowStaging = BookingStaging & BookingRow;

export type InputsStaging = Inputs & {
  projectDatabaseUrl: string;
};
