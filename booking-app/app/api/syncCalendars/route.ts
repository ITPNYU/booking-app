import { NextApiRequest, NextApiResponse } from "next";
import { Booking, MediaServices } from "@/components/src/types";
import admin from "@/firebaseAdmin";
import { getCalendarClient } from "@/lib/googleClient";
import { toFirebaseTimestampFromString } from "@/components/src/client/utils/serverDate";
import { Timestamp } from "@firebase/firestore";
import { NextResponse } from "next/server";
import { TableNames } from "@/components/src/policy";

const db = admin.firestore();
const createBookingWithDefaults = (
  partialBooking: Partial<Booking>,
): Booking => {
  return {
    title: "",
    description: "",
    email: "",
    firstName: "",
    lastName: "",
    secondaryName: "",
    nNumber: "",
    netId: "",
    phoneNumber: "",
    department: "",
    role: "",
    sponsorFirstName: "",
    sponsorLastName: "",
    sponsorEmail: "",
    bookingType: "",
    attendeeAffiliation: "",
    roomSetup: "",
    setupDetails: "",
    mediaServices: "",
    mediaServicesDetails: "",
    catering: "",
    hireSecurity: "",
    expectedAttendance: "",
    cateringService: "",
    chartFieldForCatering: "",
    chartFieldForSecurity: "",
    chartFieldForRoomSetup: "",
    calendarEventId: "",
    roomId: "",
    requestNumber: 0,
    equipmentCheckedOut: false,
    startDate: null,
    endDate: null,
    ...partialBooking,
  };
};
const findNyuEmail = (event: any): string => {
  const attendees = event.attendees || [];
  const nyuEmail = attendees.find(
    (attendee: any) => attendee.email && attendee.email.endsWith("@nyu.edu"),
  );
  return nyuEmail ? nyuEmail.email : "";
};
export async function POST(request: Request) {
  try {
    const calendar = await getCalendarClient();
    // Fetch all calendar IDs from the Resource table
    const resourcesSnapshot = await db.collection("resources").get();
    const resources = resourcesSnapshot.docs.map(doc => ({
      id: doc.id,
      calendarId: doc.data().calendarId,
      roomId: doc.data().roomId,
    }));

    let totalNewBookings = 0;
    for (const resource of resources) {
      try {
        // Fetch events for each calendar
        const now = new Date();
        const events = await calendar.events.list({
          calendarId: resource.calendarId,
          timeMin: now.toISOString(),
          maxResults: 100, // Adjust as needed
          singleEvents: true,
          orderBy: "startTime",
        });

        for (const event of events.data.items || []) {
          const bookingRef = db
            .collection("bookings")
            .where("calendarEventId", "==", event.id);
          const bookingSnapshot = await bookingRef.get();

          if (bookingSnapshot.empty) {
            // Create a new booking
            const calendarEventId = event.id;
            const nyuEmail = findNyuEmail(event);
            const newBooking = createBookingWithDefaults({
              title: event.summary || "",
              description: event.description || "",
              email: nyuEmail || "",
              startDate: toFirebaseTimestampFromString(
                event.start?.dateTime,
              ) as Timestamp,
              endDate: toFirebaseTimestampFromString(
                event.end?.dateTime,
              ) as Timestamp,
              calendarEventId: calendarEventId || "",
              equipmentCheckedOut: true,
              roomId: resource.roomId,
              mediaServices: MediaServices.CHECKOUT_EQUIPMENT,
            });
            const bookingDocRef = await db
              .collection(TableNames.BOOKING)
              .add(newBooking);

            console.log(`New Booking created with ID: ${bookingDocRef.id}`);

            const newBookingStatus = {
              calendarEventId: calendarEventId,
              email: nyuEmail,
              requestedAt: admin.firestore.FieldValue.serverTimestamp(),
              firstApprovedAt: admin.firestore.FieldValue.serverTimestamp(),
              finalApprovedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            const statusDocRef = await db
              .collection(TableNames.BOOKING_STATUS)
              .add(newBookingStatus);
            console.log(
              `New BookingStatus created with ID: ${statusDocRef.id}`,
            );

            totalNewBookings++;
          }
        }
      } catch (error) {
        console.error(
          `Error processing calendar ${resource.calendarId}:`,
          error,
        );
        // Continue with the next calendar
      }
    }

    return NextResponse.json(
      {
        message: `${totalNewBookings} new bookings have been synchronized.`,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error syncing calendars:", error);
    return NextResponse.json(
      {
        error: "An error occurred while syncing calendars.",
      },
      { status: 500 },
    );
  }
}
