import { toFirebaseTimestampFromString } from "@/components/src/client/utils/serverDate";
import { TableNames } from "@/components/src/policy";
import { Booking, MediaServices } from "@/components/src/types";
import admin from "@/lib/firebase/server/firebaseAdmin";
import { getCalendarClient } from "@/lib/googleClient";
import { Timestamp } from "@firebase/firestore";
import { NextResponse } from "next/server";

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
    let targetBookings = 0;
    for (const resource of resources) {
      try {
        // Fetch events for each calendar
        let pageToken: string | undefined;
        const now = new Date();
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth(), 1);
        const threeMonthsLater = new Date(
          now.getFullYear(),
          now.getMonth() + 4,
          0,
        );
        const timeMin = threeMonthsAgo.toISOString();
        const timeMax = threeMonthsLater.toISOString();
        const events = await calendar.events.list({
          calendarId: resource.calendarId,
          timeMin: timeMin,
          timeMax: timeMax,
          maxResults: 500, // Maximum allowed by Google Calendar API
          singleEvents: true,
          orderBy: "startTime",
          pageToken: pageToken,
        });

        for (const event of events.data.items || []) {
          const bookingRef = db
            .collection("bookings")
            .where("calendarEventId", "==", event.id);
          const bookingSnapshot = await bookingRef.get();
          const nyuEmail = findNyuEmail(event);
          if (bookingSnapshot.empty && nyuEmail) {
            targetBookings++;
            console.log("calendarEventId", event.id);
            console.log("title", event.summary);
          }

          if (bookingSnapshot.empty && nyuEmail) {
            // Create a new booking
            const calendarEventId = event.id;
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
            console.log("newBooking", newBooking);
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
            console.log("newBookingStatus", newBookingStatus);
            const statusDocRef = await db
              .collection(TableNames.BOOKING_STATUS)
              .add(newBookingStatus);
            console.log(
              `New BookingStatus created with ID: ${statusDocRef.id}`,
            );

            totalNewBookings++;
          }
          pageToken = events.data.nextPageToken;
        }
        while (pageToken);
        console.log("targetBookings", targetBookings);
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
