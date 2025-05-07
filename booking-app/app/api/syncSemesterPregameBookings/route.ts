import { toFirebaseTimestampFromString } from "@/components/src/client/utils/serverDate";
import { TableNames } from "@/components/src/policy";
import {
  Booking,
  BookingStatusLabel,
  MediaServices,
} from "@/components/src/types";
import { serverGetNextSequentialId } from "@/lib/firebase/server/adminDb";
import admin from "@/lib/firebase/server/firebaseAdmin";
import { getCalendarClient } from "@/lib/googleClient";
import { Timestamp } from "firebase/firestore";
import { NextResponse } from "next/server";

const db = admin.firestore();

const parseEmails = (emailString: string): string[] => {
  // Match all email addresses that end with @nyu.edu
  const emailRegex = /[a-zA-Z0-9._%+-]+@nyu\.edu/g;
  const emails = emailString.match(emailRegex) || [];
  return Array.from(new Set(emails)); // Remove duplicates
};
const findRoomIds = (title: string): string => {
  const match = title.match(/^\d+(,\s*\d+)*/);
  return match ? match[0] : ""; // マッチした場合は数値リスト、なければ空文字を返す
};

const getRequesterEmails = (description: string): string[] => {
  // Find content between Requester Details h2 tag and Reservation Details h2 tag
  const regex =
    /<h2[^>]*>Requester Details[^>]*>([^<]*)<h2[^>]*>Reservation Details/;
  const match = description.match(regex);

  if (!match) return [];

  return parseEmails(match[1]);
};

const parseDescription = (
  description: string,
): Partial<Booking> & { additionalEmails: string[] } => {
  const bookingDetails: Partial<Booking> & { additionalEmails: string[] } = {
    additionalEmails: [],
  };

  // Extract emails from Requester Details
  const emails = getRequesterEmails(description);
  if (emails.length > 0) {
    bookingDetails.email = emails[0];
    bookingDetails.additionalEmails = emails.slice(1);
  }

  // Rest of the parsing logic remains the same

  const descriptionMatch = description.match(
    /Brief Event Description\s*:\s*([^•]+)<h2[^>]*>Cancellation Policy/,
  );
  if (descriptionMatch) {
    bookingDetails.description = descriptionMatch[1].trim();
  }
  const mediaServicesArray: MediaServices[] = [];
  let mediaServicesDetails = "";

  // Parse Audio Lab Staffing Needs
  const audioLabMatch = description.match(
    /Audio Lab Staffing Needs:\s*([^•]+)/,
  );
  if (audioLabMatch) {
    const audioLabNeeds = audioLabMatch[1].trim();
    if (audioLabNeeds !== "false" && !audioLabNeeds.startsWith("N/A")) {
      mediaServicesArray.push(MediaServices.AUDIO_TECH_230);
      if (audioLabNeeds !== "true") {
        mediaServicesDetails += `Audio Lab: ${audioLabNeeds}\n`;
      }
    }
  }

  // Parse Garage Lighting Staffing Needs
  const garageLightingMatch = description.match(
    /Garage Lighting Staffing Needs\s*:\s*([^•]+)/,
  );
  if (garageLightingMatch) {
    const value = garageLightingMatch[1].trim();
    if (value !== "false" && !value.startsWith("N/A")) {
      mediaServicesArray.push(MediaServices.LIGHTING_TECH_103);
      if (value !== "true") {
        mediaServicesDetails += `Garage Lighting: ${value}\n`;
      }
    }
  }

  // Parse Garage Audio Staffing Needs
  const garageAudioMatch = description.match(
    /Garage Audio Staffing Needs\s*:\s*([^•]+)/,
  );
  if (garageAudioMatch) {
    const value = garageAudioMatch[1].trim();
    if (value !== "false" && !value.startsWith("N/A")) {
      mediaServicesArray.push(MediaServices.AUDIO_TECH_103);
      if (value !== "true") {
        mediaServicesDetails += `Garage Audio: ${value}\n`;
      }
    }
  }

  // Parse Equipment Rental
  const equipmentRentalMatch = description.match(
    /Equipment Rental\s*:\s*([^•]+)/,
  );
  if (equipmentRentalMatch) {
    const value = equipmentRentalMatch[1].trim().toLowerCase();
    if (value === "true") {
      mediaServicesArray.push(MediaServices.CHECKOUT_EQUIPMENT);
    }
  }

  // Set mediaServices and mediaServicesDetails if any services were requested
  if (mediaServicesArray.length > 0) {
    bookingDetails.mediaServices = mediaServicesArray.join(",");
    if (mediaServicesDetails.trim()) {
      bookingDetails.mediaServicesDetails = mediaServicesDetails.trim();
    }
  }

  const parseField = (fieldName: string): string => {
    const regex = new RegExp(`${fieldName}\\s*:\\s*([^•]+)`);
    const match = description.match(regex);
    if (!match) return "No";

    const value = match[1].trim().toLowerCase();
    return value === "true" ? "Yes" : "No";
  };

  bookingDetails.catering = parseField("Catering");
  bookingDetails.roomSetup = parseField("Room Setup");
  bookingDetails.hireSecurity = parseField("Campus Safety");

  return bookingDetails;
};
const hasRequesterDetails = (description: string): boolean => {
  return description?.includes("Requester Details");
};

const findGuestEmails = (event: any, description: string): string[] => {
  const guestEmails = new Set<string>();
  const parsedDetails = parseDescription(description);

  // Add primary email if exists
  if (parsedDetails.email) {
    guestEmails.add(parsedDetails.email);
  }

  // Add additional emails if any
  if (parsedDetails.additionalEmails?.length > 0) {
    parsedDetails.additionalEmails.forEach(email => guestEmails.add(email));
  }

  // Add existing attendees that are not calendar resources
  if (event.attendees?.length > 0) {
    event.attendees.forEach((attendee: any) => {
      if (
        attendee.email &&
        !attendee.email.endsWith("@group.calendar.google.com")
      ) {
        guestEmails.add(attendee.email);
      }
    });
  }

  return Array.from(guestEmails);
};

const createBookingWithDefaults = (
  partialBooking: Partial<Booking>,
): Booking => {
  //@ts-ignore
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
    requestedAt: undefined,

    ...partialBooking,
  };
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
    const oneMonthsAgo = new Date(now.getFullYear(), now.getMonth(), 1);
    const fifthMonthsLater = new Date(now.getFullYear(), now.getMonth() + 6, 0);
    const timeMin = oneMonthsAgo.toISOString();
    const timeMax = fifthMonthsLater.toISOString();

    for (const resource of resources) {
      console.log("calendarId", resource.calendarId);
      try {
        let pageToken: string | undefined;
        const calendarId = resource.calendarId;
        do {
          const events = await calendar.events.list({
            calendarId: calendarId,
            timeMin: timeMin,
            timeMax: timeMax,
            maxResults: 500,
            singleEvents: true,
            orderBy: "startTime",
            pageToken: pageToken,
          });

          for (const event of events.data.items || []) {
            //Skip not pregame events
            console.log(event.summary);
            console.log(
              "Is it pregame event?",
              hasRequesterDetails(event.description),
            );
            if (hasRequesterDetails(event.description)) {
              const bookingRef = db
                .collection("bookings")
                .where("calendarEventId", "==", event.id);
              const bookingSnapshot = await bookingRef.get();
              const description = event.description || "";
              const parsedDetails = parseDescription(description);
              const guestEmails = findGuestEmails(event, description);
              const roomIds = findRoomIds(event.summary);
              const startDate = toFirebaseTimestampFromString(
                event.start?.dateTime,
              ) as Timestamp;
              const title = event.summary;
              const sanitizedTitle = title.replace(/^\[.*?\]\s*/, ""); // `[PENDING]` を削除

              const existingBookingSnapshot = await db
                .collection("bookings")
                .where("title", "==", sanitizedTitle)
                .where("startDate", "==", startDate)
                .get();

              if (!existingBookingSnapshot.empty) {
                console.log(
                  `A Booking with title "${title}" and startDate "${event.start?.dateTime}" already exists.`,
                );

                // Add [PENDING]
                if (
                  !title.startsWith("[") &&
                  !title.includes(`[${BookingStatusLabel.PENDING}]`)
                ) {
                  const newTitle = `[${BookingStatusLabel.PENDING}] ${title}`;
                  console.log(
                    `Renaming existing event title from "${title}" to "${newTitle}".`,
                  );

                  await calendar.events.patch({
                    calendarId: resource.calendarId,
                    eventId: event.id!,
                    requestBody: {
                      summary: newTitle,
                    },
                  });
                }
                continue;
              }

              if (bookingSnapshot.empty && guestEmails) {
                targetBookings++;
                console.log("calendarEventId", event.id);
                console.log("title", event.summary);
                console.log("guestEmails[0]", guestEmails[0]);

                const calendarEventId = event.id;
                const newBooking = createBookingWithDefaults({
                  ...parsedDetails,
                  title: sanitizedTitle,
                  email: guestEmails[0],
                  startDate: toFirebaseTimestampFromString(
                    event.start?.dateTime,
                  ) as Timestamp,
                  endDate: toFirebaseTimestampFromString(
                    event.end?.dateTime,
                  ) as Timestamp,
                  calendarEventId: calendarEventId || "",
                  roomId: roomIds,
                  requestNumber: await serverGetNextSequentialId("bookings"),
                  netId: guestEmails[0] ? guestEmails[0].split("@")[0] : "",
                });

                console.log("newBooking", newBooking);
                const newTitle = `[${BookingStatusLabel.PENDING}] ${event.summary}`;
                const bookingDocRef = await db
                  .collection(TableNames.BOOKING)
                  .add({
                    ...newBooking,
                    requestedAt: admin.firestore.FieldValue.serverTimestamp(),
                    firstApprovedAt:
                      admin.firestore.FieldValue.serverTimestamp(),
                  });

                //Add all requesters as guests to the calendar event
                if (event.id) {
                  await calendar.events.patch({
                    calendarId: resource.calendarId,
                    eventId: event.id,
                    requestBody: {
                      summary: newTitle,
                    },
                  });
                }

                console.log(`New Booking created with ID: ${bookingDocRef.id}`);
                totalNewBookings++;
              }
            }
          }
          pageToken = events.data.nextPageToken;
        } while (pageToken);
      } catch (error) {
        console.error(
          `Error processing calendar ${resource.calendarId}:`,
          error,
        );
      }
    }

    console.log("targetBookings", targetBookings);
    console.log("totalNewBookings", totalNewBookings);
    console.log("totalUpdatedBookings", totalUpdatedBookings);

    return NextResponse.json(
      {
        message: `${totalNewBookings} new bookings have been synchronized. ${totalUpdatedBookings} existing bookings have been updated with multiple rooms.`,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error syncing calendars:", error);
    return NextResponse.json(
      { error: "An error occurred while syncing calendars." },
      { status: 500 },
    );
  }
}
