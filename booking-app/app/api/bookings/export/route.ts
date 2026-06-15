import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { NextRequest, NextResponse } from "next/server";

import { TableNames } from "@/components/src/policy";
import { Booking, RoomSetting, formatOrigin } from "@/components/src/types";
import {
  getServerTenantCollection,
  serverGetDocumentById,
} from "@/lib/firebase/server/adminDb";
import admin from "@/lib/firebase/server/firebaseAdmin";
import { applyEnvironmentCalendarIds } from "@/lib/utils/calendarEnvironment";
import { toFirebaseTimestamp } from "@/components/src/client/utils/serverDate";
import { formatInTimeZone } from "date-fns-tz";

import { TIMEZONE } from "../shared";

const HEADERS = [
  "Request #",
  "School",
  "Department",
  "Role (Affiliation)",
  "Room(s)",
  "Booking Start Date",
  "Booking End Date",
  "Booking Start Time",
  "Booking End Time",
  "Time In Use, Hours",
  "# rooms used",
  "ACTUAL hours",
  "Reservation Title",
  "Reservation Description",
  "Expected Attendance",
  "Reservation Origin",
  "Booking Type",
  "Attendee Affiliation(s)",
  "End Event Status",
  "Requested At",
  "First Approved At",
  "Final Approved At",
  "Declined At",
  "Checked In At",
  "Checked Out At",
  "No Show At",
  "Canceled At",
  "Closed At",
  "Room Setup Needed (Y/N)",
  "Room Setup Details",
  "Equipment Services (Y/N)",
  "Equipment Service Details",
  "Staffing Services (Y/N)",
  "Staffing Service Details",
  "Catering (Y/N)",
  "Cleaning Services (Y/N)",
  "Hire Security (Y/N)",
] as const;

const escapeCsv = (value: unknown): string => {
  if (value == null) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const toDate = (timestamp: unknown): Date | null => {
  if (timestamp == null) return null;
  try {
    const date = toFirebaseTimestamp(timestamp as any).toDate();
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
};

const safeFormat = (timestamp: unknown, fmt: string): string => {
  const date = toDate(timestamp);
  return date ? formatInTimeZone(date, TIMEZONE, fmt) : "";
};

const getBookingStatus = (booking: Booking): string => {
  if (booking.finalApprovedAt) return "Approved";
  if (booking.declinedAt) return "Declined";
  if (booking.canceledAt) return "Canceled";
  if (booking.checkedOutAt) return "Checked out";
  if (booking.checkedInAt) return "Checked in";
  if (booking.noShowedAt) return "No Show";
  if (booking.firstApprovedAt) return "Pending";
  return "Requested";
};

const calculateTimeInUse = (startDate: unknown, endDate: unknown): number => {
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (!start || !end) return 0;
  return (
    Math.round(((end.getTime() - start.getTime()) / (1000 * 60 * 60)) * 100) /
    100
  );
};

const countRooms = (roomId: string | number): number => {
  const roomIdStr = String(roomId);
  return roomIdStr.includes(",") ? roomIdStr.split(",").length : 1;
};

const buildRow = (booking: Booking): string => {
  const timeInUse = calculateTimeInUse(booking.startDate, booking.endDate);
  const roomCount = countRooms(booking.roomId);
  const b = booking as any;

  const values: unknown[] = [
    booking.requestNumber,
    b.school === "Other" && b.otherSchool ? b.otherSchool : b.school || "",
    booking.department === "Other" && booking.otherDepartment
      ? booking.otherDepartment
      : booking.department,
    booking.role,
    booking.roomId,
    safeFormat(booking.startDate, "M/d/yyyy"),
    safeFormat(booking.endDate, "M/d/yyyy"),
    safeFormat(booking.startDate, "h:mm a"),
    safeFormat(booking.endDate, "h:mm a"),
    timeInUse,
    roomCount,
    timeInUse * roomCount,
    booking.title,
    booking.description,
    booking.expectedAttendance,
    booking.origin ? formatOrigin(booking.origin) : "",
    booking.bookingType,
    booking.attendeeAffiliation,
    getBookingStatus(booking),
    safeFormat(booking.requestedAt, "M/d/yyyy h:mm a"),
    safeFormat(booking.firstApprovedAt, "M/d/yyyy h:mm a"),
    safeFormat(booking.finalApprovedAt, "M/d/yyyy h:mm a"),
    safeFormat(booking.declinedAt, "M/d/yyyy h:mm a"),
    safeFormat(booking.checkedInAt, "M/d/yyyy h:mm a"),
    safeFormat(booking.checkedOutAt, "M/d/yyyy h:mm a"),
    safeFormat(booking.noShowedAt, "M/d/yyyy h:mm a"),
    safeFormat(booking.canceledAt, "M/d/yyyy h:mm a"),
    safeFormat(booking.closedAt, "M/d/yyyy h:mm a"),
    booking.roomSetup === "yes" ? "Yes" : "No",
    booking.setupDetails || "",
    booking.equipmentServices && booking.equipmentServices.length > 0
      ? "Yes"
      : "No",
    booking.equipmentServicesDetails || "",
    booking.staffingServices && booking.staffingServices.length > 0
      ? "Yes"
      : "No",
    booking.staffingServicesDetails || "",
    booking.catering === "yes" ? "Yes" : "No",
    booking.cleaningService === "yes" ? "Yes" : "No",
    booking.hireSecurity === "yes" ? "Yes" : "No",
  ];

  return values.map(escapeCsv).join(",");
};

export async function GET(request: NextRequest) {
  const tenant = request.headers.get("x-tenant") || DEFAULT_TENANT;

  // Schema is small; fetched up front so room mapping (if needed in future
  // columns) is available before we start streaming rows.
  const schema = await serverGetDocumentById(TableNames.TENANT_SCHEMA, tenant);
  const resourcesWithCorrectCalendarIds = schema?.resources
    ? applyEnvironmentCalendarIds(schema.resources)
    : [];
  const rooms: RoomSetting[] = resourcesWithCorrectCalendarIds.map(
    (resource: any) => ({
      roomId: String(resource.resourceId ?? resource.roomId),
      name: resource.name,
      capacity: resource.capacity.toString(),
      calendarId: resource.calendarId,
      calendarRef: undefined,
    }),
  );
  // Reserved for future column additions that need the lookup.
  void rooms;

  const collectionName = getServerTenantCollection(TableNames.BOOKING, tenant);
  const docStream = admin
    .firestore()
    .collection(collectionName)
    .orderBy("requestNumber")
    .stream() as unknown as NodeJS.ReadableStream & { destroy: () => void };

  const encoder = new TextEncoder();
  const headerLine = HEADERS.map(escapeCsv).join(",") + "\n";

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(headerLine));
      docStream.on("data", (docSnap: any) => {
        try {
          const booking = { id: docSnap.id, ...docSnap.data() } as Booking;
          controller.enqueue(encoder.encode(buildRow(booking) + "\n"));
        } catch (err) {
          controller.error(err);
          docStream.destroy();
        }
      });
      docStream.on("end", () => controller.close());
      docStream.on("error", (err: Error) => controller.error(err));
    },
    cancel() {
      docStream.destroy();
    },
  });

  const currentDate = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bookings_export_${currentDate}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
