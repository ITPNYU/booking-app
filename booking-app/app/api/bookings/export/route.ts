import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { NextRequest, NextResponse } from "next/server";

import { TableNames } from "@/components/src/policy";
import { Booking, BookingOrigin, RoomSetting } from "@/components/src/types";
import {
  serverFetchAllDataFromCollection,
  serverGetDocumentById,
} from "@/lib/firebase/server/adminDb";
import { format } from "date-fns";
import { parse } from "json2csv";

export async function GET(request: NextRequest) {
  // Get tenant from request headers or default to 'mc'
  const tenant = request.headers.get("x-tenant") || DEFAULT_TENANT;

  const [bookings, schema] = await Promise.all([
    serverFetchAllDataFromCollection<Booking>(TableNames.BOOKING, [], tenant),
    serverGetDocumentById(TableNames.TENANT_SCHEMA, tenant),
  ]);

  // Convert schema resources to RoomSetting format
  const rooms: RoomSetting[] =
    schema?.resources?.map((resource: any) => ({
      roomId: resource.roomId,
      name: resource.name,
      capacity: resource.capacity.toString(),
      calendarId: resource.calendarId,
      calendarRef: undefined,
    })) || [];

  // Create room ID to name mapping
  const roomMap = new Map<number, string>();
  rooms.forEach(room => {
    roomMap.set(room.roomId, room.name);
  });

  // Helper function to determine booking status
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

  // Helper function to calculate time in use hours
  const calculateTimeInUse = (startDate: any, endDate: any): number => {
    const start = toDate(startDate);
    const end = toDate(endDate);
    return (
      Math.round(((end.getTime() - start.getTime()) / (1000 * 60 * 60)) * 100) /
      100
    );
  };

  // Helper function to count rooms used
  const countRooms = (roomId: string | number): number => {
    const roomIdStr = String(roomId);
    return roomIdStr.includes(",") ? roomIdStr.split(",").length : 1;
  };

  // Helper function to convert Timestamp to Date
  const toDate = (timestamp: any): Date => {
    if (timestamp && typeof timestamp.toDate === "function") {
      return timestamp.toDate();
    }
    return new Date(timestamp);
  };

  // Transform bookings to CSV format
  const csvData = bookings
    .sort((a, b) => a.requestNumber - b.requestNumber)
    .map(booking => {
      const startDate = toDate(booking.startDate);
      const endDate = toDate(booking.endDate);
      const timeInUse = calculateTimeInUse(booking.startDate, booking.endDate);
      const roomCount = countRooms(booking.roomId);

      return {
        "Request #": booking.requestNumber,
        School:
          (booking as any).school === "Other" && (booking as any).otherSchool
            ? (booking as any).otherSchool
            : (booking as any).school || "",
        Department: booking.department === "Other" && booking.otherDepartment ? booking.otherDepartment : booking.department,
        "Role (Affiliation)": booking.role,
        "Room(s)": booking.roomId,
        "Booking Start Date": format(startDate, "M/d/yyyy"),
        "Booking End Date": format(endDate, "M/d/yyyy"),
        "Booking Start Time": format(startDate, "h:mm a"),
        "Booking End Time": format(endDate, "h:mm a"),
        "Time In Use, Hours": timeInUse,
        "# rooms used": roomCount,
        "ACTUAL hours": timeInUse * roomCount,
        "Reservation Title": booking.title,
        "Reservation Description": booking.description,
        "Expected Attendance": booking.expectedAttendance,
        "Reservation Origin":
          booking.origin ||
          (!booking.department && !booking.role
            ? BookingOrigin.PREGAME
            : BookingOrigin.USER),
        "Booking Type": booking.bookingType,
        "Attendee Affiliation(s)": booking.attendeeAffiliation,
        "End Event Status": getBookingStatus(booking),
        "Room Setup Needed (Y/N)": booking.roomSetup === "yes" ? "Yes" : "No",
        "Room Setup Details": booking.setupDetails || "",
        "Equipment Services (Y/N)":
          booking.equipmentServices && booking.equipmentServices.length > 0
            ? "Yes"
            : "No",
        "Equipment Service Details": booking.equipmentServicesDetails || "",
        "Staffing Services (Y/N)":
          booking.staffingServices && booking.staffingServices.length > 0
            ? "Yes"
            : "No",
        "Staffing Service Details": booking.staffingServicesDetails || "",
        "Catering (Y/N)": booking.catering === "yes" ? "Yes" : "No",
        "Cleaning Services (Y/N)": booking.cleaningService === "yes" ? "Yes" : "No",
        "Hire Security (Y/N)": booking.hireSecurity === "yes" ? "Yes" : "No",
      };
    });

  try {
    const csv = parse(csvData);
    const currentDate = format(new Date(), "yyyy-MM-dd");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="bookings_export_${currentDate}.csv"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate CSV data" },
      { status: 400 },
    );
  }
}
