import { toFirebaseTimestampFromString } from "@/components/src/client/utils/serverDate";
import { TableNames } from "@/components/src/policy";
import { Booking, MediaServices } from "@/components/src/types";
import admin from "@/lib/firebase/server/firebaseAdmin";
import { getCalendarClient } from "@/lib/googleClient";
import { Timestamp } from "@firebase/firestore";
import { NextResponse } from "next/server";

const db = admin.firestore();
const areRoomIdsSame = (roomIds1: string, roomIds2: string): boolean => {
  // Trim and split the room IDs, then sort both arrays
  const sortedRoomIds1 = roomIds1.split(',').map(id => id.trim()).sort();
  const sortedRoomIds2 = roomIds2.split(',').map(id => id.trim()).sort();
  
  // Compare the two arrays
  return sortedRoomIds1.length === sortedRoomIds2.length &&
         sortedRoomIds1.every((id, index) => id === sortedRoomIds2[index]);
};
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
    otherDepartment: "",
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

const findGuestEmail = (event: any): string => {
  const attendees = event.attendees || [];
  const guestEmail = attendees.find((attendee: any) => 
    attendee.email && !attendee.email.endsWith('@group.calendar.google.com')
  );
  return guestEmail ? guestEmail.email : "";
};
const findRoomIds = (event: any, resources: any[]): string => {
  const attendees = event.attendees || [];
  const roomIds = new Set<string>();

  // Add the roomId of the current resource
  const currentResource = resources.find(r => r.calendarId === event.organizer.email);
  if (currentResource) {
    roomIds.add(currentResource.roomId);
  }

  // Add other room IDs
  attendees.forEach((attendee: any) => {
    const resource = resources.find(r => r.calendarId === attendee.email);
    if (resource) {
      roomIds.add(resource.roomId);
    }
  });

  // Convert to array, sort numerically, and join
  return Array.from(roomIds)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .join(',');
};

export async function POST(request: Request) {
  try {
    const calendar = await getCalendarClient();
    const resourcesSnapshot = await db.collection("resources").get();
    const resources = resourcesSnapshot.docs.map(doc => ({
      id: doc.id,
      calendarId: doc.data().calendarId,
      roomId: doc.data().roomId,
    }));

    let totalNewBookings = 0;
    let totalUpdatedBookings = 0;
    let targetBookings = 0;

    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const threeMonthsLater = new Date(now.getFullYear(), now.getMonth() + 4, 0);
    const timeMin = threeMonthsAgo.toISOString();
    const timeMax = threeMonthsLater.toISOString();

    for (const resource of resources) {
      try {
        let pageToken: string | undefined;
        do {
          const events = await calendar.events.list({
            calendarId: resource.calendarId,
            timeMin: timeMin,
            timeMax: timeMax,
            maxResults: 500,
            singleEvents: true,
            orderBy: "startTime",
            pageToken: pageToken,
          });

          for (const event of events.data.items || []) {
            const bookingRef = db
              .collection("bookings")
              .where("calendarEventId", "==", event.id);
            const bookingSnapshot = await bookingRef.get();
            const guestEmail = findGuestEmail(event);
            const roomIds = findRoomIds(event, resources);

            if (bookingSnapshot.empty && guestEmail) {
              targetBookings++;
              console.log("calendarEventId", event.id);
              console.log("title", event.summary);

              const calendarEventId = event.id;
              const newBooking = createBookingWithDefaults({
                title: event.summary || "",
                description: event.description || "",
                email: guestEmail,
                startDate: toFirebaseTimestampFromString(event.start?.dateTime) as Timestamp,
                endDate: toFirebaseTimestampFromString(event.end?.dateTime) as Timestamp,
                calendarEventId: calendarEventId || "",
                roomId: roomIds,
                mediaServices: MediaServices.CHECKOUT_EQUIPMENT,
              });

              console.log("newBooking", newBooking);
              const bookingDocRef = await db
                .collection(TableNames.BOOKING)
                .add(newBooking);

              console.log(`New Booking created with ID: ${bookingDocRef.id}`);

              const newBookingStatus = {
                calendarEventId: calendarEventId,
                email: guestEmail,
                requestedAt: admin.firestore.FieldValue.serverTimestamp(),
                firstApprovedAt: admin.firestore.FieldValue.serverTimestamp(),
                finalApprovedAt: admin.firestore.FieldValue.serverTimestamp(),
              };
              console.log("newBookingStatus", newBookingStatus);
              const statusDocRef = await db
                .collection(TableNames.BOOKING_STATUS)
                .add(newBookingStatus);
              console.log(`New BookingStatus created with ID: ${statusDocRef.id}`);

              totalNewBookings++;
            } else if (!bookingSnapshot.empty) {
              // Update existing booking if roomIds contains multiple rooms and is different from the existing roomId
              const existingBooking = bookingSnapshot.docs[0];
              const existingData = existingBooking.data() as Booking;
              
              if (roomIds.includes(',') && !areRoomIdsSame(roomIds, existingData.roomId)) {
                console.log("roomIds",roomIds)
                console.log("existingData.roomId",existingData.roomId)
                await existingBooking.ref.update({ roomId: roomIds });
                console.log(`Updated roomId for Booking ID: ${existingBooking.id}`);
                totalUpdatedBookings++;
              }
            }
          }
          pageToken = events.data.nextPageToken;
        } while (pageToken);
      } catch (error) {
        console.error(`Error processing calendar ${resource.calendarId}:`, error);
      }
    }

    console.log("targetBookings", targetBookings);
    console.log("totalNewBookings", totalNewBookings);
    console.log("totalUpdatedBookings", totalUpdatedBookings);
    
    return NextResponse.json(
      { 
        message: `${totalNewBookings} new bookings have been synchronized. ${totalUpdatedBookings} existing bookings have been updated with multiple rooms.` 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error syncing calendars:", error);
    return NextResponse.json(
      { error: "An error occurred while syncing calendars." },
      { status: 500 }
    );
  }
}