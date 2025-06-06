import { NextRequest, NextResponse } from "next/server";

import { TableNames } from "@/components/src/policy";
import { Booking, RoomSetting } from "@/components/src/types";
import { serverFetchAllDataFromCollection } from "@/lib/firebase/server/adminDb";
import { format } from "date-fns";
import { parse } from "json2csv";

export async function GET(request: NextRequest) {
  const [bookings, rooms] = await Promise.all([
    serverFetchAllDataFromCollection<Booking>(TableNames.BOOKING),
    serverFetchAllDataFromCollection<RoomSetting>(TableNames.RESOURCES),
  ]);

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
        Department: booking.department,
        "Role (Affiliation)": booking.role,
        "Room(s)": booking.roomId,
        "Booking Start Date": format(startDate, "M/d/yyyy"),
        "Booking End Date": format(endDate, "M/d/yyyy"),
        "Booking Start Time": format(startDate, "h:mm a"),
        "Booking End Time": format(endDate, "h:mm a"),
        "Time In Use, Hours": timeInUse,
        "# rooms used": roomCount,
        "ACTUAL hours": `${timeInUse} x ${roomCount} x 1 = ${timeInUse * roomCount}`,
        "Reservation Title": booking.title,
        "Reservation Description": booking.description,
        "Expected Attendance": booking.expectedAttendance,
        "Reservation Origin":
          booking.origin ||
          (!booking.department && !booking.role ? "Pre-game" : "User"),
        "Booking Type": booking.bookingType,
        "Attendee Affiliation(s)": booking.attendeeAffiliation,
        "End Event Status": getBookingStatus(booking),
        "Room Setup Needed (Y/N)": booking.roomSetup === "yes" ? "Yes" : "No",
        "Room Setup Details": booking.setupDetails || "",
        "Media Services (Y/N)":
          booking.mediaServices && booking.mediaServices.length > 0
            ? "Yes"
            : "No",
        "Media Service Details": booking.mediaServicesDetails || "",
        "Catering (Y/N)": booking.catering === "yes" ? "Yes" : "No",
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
