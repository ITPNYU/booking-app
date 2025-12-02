import { toFirebaseTimestampFromString } from "@/components/src/client/utils/serverDate";
import { TableNames } from "@/components/src/policy";
import {
  Booking,
  BookingOrigin,
  BookingStatusLabel,
  MediaServices,
} from "@/components/src/types";
import {
  serverGetDocumentById,
  serverGetNextSequentialId,
} from "@/lib/firebase/server/adminDb";
import { getCalendarId } from "@/lib/utils/calendarUtils";
import admin from "@/lib/firebase/server/firebaseAdmin";
import { getCalendarClient } from "@/lib/googleClient";
import { Timestamp } from "firebase/firestore";
import { NextResponse } from "next/server";

const db = admin.firestore();

const parseEmails = (emailString: string): string[] => {
  // Match all email addresses that end with @nyu.edu
  const emailRegex = /[a-zA-Z0-9._%+-]+@nyu\.edu/g;
  const emails = emailString.match(emailRegex) || [];
  // Remove HTML tags and clean up emails
  const cleanEmails = emails.map(email => email.replace(/<[^>]*>/g, "").trim());
  return Array.from(new Set(cleanEmails)); // Remove duplicates
};
const findRoomIds = (title: string, description?: string): string => {
  // First try to extract from title (old format)
  const titleMatch = title.match(/^\d+(,\s*\d+)*/);
  if (titleMatch) {
    return titleMatch[0];
  }

  // Try to extract from description (new format)
  if (description) {
    const roomRegex = /•\s*Room\(s\):\s*([^\n•]+)/i;
    const roomMatch = description.match(roomRegex);
    if (roomMatch) {
      return roomMatch[1].trim();
    }
  }

  return "";
};

const getRequesterEmails = (description: string): string[] => {
  // First try the old format
  const oldFormatRegex =
    /<h2[^>]*>Requester Details[^>]*>([^<]*)<h2[^>]*>Reservation Details/;
  const oldMatch = description.match(oldFormatRegex);

  if (oldMatch) {
    return parseEmails(oldMatch[1]);
  }

  // Try the new format - extract email from the Requester section
  const emailRegex = /•\s*Email:\s*([^\n•]+)/i;
  const emailMatch = description.match(emailRegex);

  if (emailMatch) {
    const email = emailMatch[1].replace(/<[^>]*>/g, "").trim();
    if (email && email !== "none" && email.includes("@")) {
      return [email];
    }
  }

  // Fallback: try to extract NetID and construct email
  const netIdRegex = /•\s*NetID:\s*([^\n•]+)/i;
  const netIdMatch = description.match(netIdRegex);

  if (netIdMatch) {
    const netId = netIdMatch[1].replace(/<[^>]*>/g, "").trim();
    if (netId && netId !== "none") {
      return [`${netId}@nyu.edu`];
    }
  }

  return [];
};

const parseDescription = (
  description: string,
): Partial<Booking> & { additionalEmails: string[] } => {
  const bookingDetails: Partial<Booking> & { additionalEmails: string[] } = {
    additionalEmails: [],
  };

  // Helper function to extract field value from new format and remove HTML tags
  const extractFieldValue = (fieldName: string): string => {
    const regex = new RegExp(
      `•\\s*${fieldName}:\\s*([^\\n•]+?)(?:<br\\/?>|$)`,
      "i",
    );
    const match = description.match(regex);
    if (!match) return "";

    let value = match[1].trim();

    // If the value contains only "none" (case insensitive), return "none"
    if (value.toLowerCase().replace(/\s+/g, "") === "none") {
      return "none";
    }

    // For cleaning field, convert "true" to boolean string representation
    if (fieldName === "Cleaning" && value.toLowerCase() === "true") {
      return "true";
    }

    return value;
  };

  // Parse Requester section
  const netId = extractFieldValue("NetID");
  if (netId) {
    bookingDetails.netId = netId;
    bookingDetails.email = `${netId}@nyu.edu`;
  }

  const nameMatch = extractFieldValue("Name");
  if (nameMatch) {
    const nameParts = nameMatch.split(" ");
    bookingDetails.firstName = nameParts[0] || "";
    bookingDetails.lastName = nameParts.slice(1).join(" ") || "";
  }

  const department = extractFieldValue("Department");
  if (department && department !== "none") {
    bookingDetails.department = department;
  }

  const email = extractFieldValue("Email");
  if (email && email !== "none" && email !== bookingDetails.email) {
    bookingDetails.email = email;
    // Extract netId from email if different
    if (email.includes("@nyu.edu")) {
      bookingDetails.netId = email.split("@")[0];
    }
  }

  const phone = extractFieldValue("Phone");
  if (phone && phone !== "none") {
    bookingDetails.phoneNumber = phone;
  }

  const secondaryContact = extractFieldValue("Secondary Contact Name");
  if (secondaryContact && secondaryContact !== "none") {
    bookingDetails.secondaryName = secondaryContact;
  }

  const sponsorName = extractFieldValue("Sponsor Name");
  if (sponsorName && sponsorName !== "none") {
    const sponsorParts = sponsorName.split(" ");
    bookingDetails.sponsorFirstName = sponsorParts[0] || "";
    bookingDetails.sponsorLastName = sponsorParts.slice(1).join(" ") || "";
  }

  const sponsorEmail = extractFieldValue("Sponsor Email");
  if (sponsorEmail && sponsorEmail !== "none") {
    bookingDetails.sponsorEmail = sponsorEmail;
  }

  // Parse Details section
  const title = extractFieldValue("Title");
  if (title) {
    bookingDetails.title = title;
  }

  const eventDescription = extractFieldValue("Description");
  if (eventDescription) {
    bookingDetails.description = eventDescription;
  }

  const category = extractFieldValue("Category");
  bookingDetails.bookingType = "";

  const expectedAttendance = extractFieldValue("Expected Attendance");
  console.log("expectedAttendance", expectedAttendance);
  if (expectedAttendance && expectedAttendance !== "none") {
    // Map <50 to "19" and >50 to "50"
    if (expectedAttendance.includes("<50")) {
      bookingDetails.expectedAttendance = "19";
    } else if (expectedAttendance.includes(">50")) {
      bookingDetails.expectedAttendance = "50";
    } else {
      bookingDetails.expectedAttendance = expectedAttendance;
    }
  }

  const attendeeAffiliation = extractFieldValue("Attendee Affiliation");
  if (attendeeAffiliation && attendeeAffiliation !== "none") {
    bookingDetails.attendeeAffiliation = attendeeAffiliation;
  }

  // Parse Services section - record all fields individually
  const roomSetup = extractFieldValue("Room Setup");
  bookingDetails.roomSetup = roomSetup !== "none" ? roomSetup : "";
  // Note: roomSetup field is used for both Yes/No flag and actual value

  const equipment = extractFieldValue("Equipment");
  bookingDetails.equipmentServices = equipment !== "none" ? equipment : "";

  // Still maintain mediaServices for compatibility
  let mediaServicesArray: MediaServices[] = [];
  if (equipment && equipment !== "none") {
    bookingDetails.mediaServices = equipment;
  }

  const staffing = extractFieldValue("Staffing");
  bookingDetails.staffingServices = staffing !== "none" ? staffing : "";

  if (staffing && staffing !== "none") {
    bookingDetails.staffingServices = staffing;
  }

  // Set media services if any were requested (for compatibility)
  if (mediaServicesArray.length > 0) {
    bookingDetails.mediaServices = mediaServicesArray.join(",");
  }

  const catering = extractFieldValue("Catering");
  bookingDetails.catering = catering !== "none" ? catering : "";
  if (catering && catering !== "none") {
    bookingDetails.cateringService = catering;
  }

  const cleaning = extractFieldValue("Cleaning");
  bookingDetails.cleaning = cleaning !== "none" ? cleaning : "";

  const security = extractFieldValue("Security");
  bookingDetails.hireSecurity = security !== "none" ? security : "";

  // Set origin to pregame
  bookingDetails.origin = BookingOrigin.PREGAME;

  return bookingDetails;
};
const isPregameEvent = (title: string, description): boolean => {
  // Pregame events must have "Origin: Pregame" in description
  const hasPregameOrigin =
    description &&
    typeof description === "string" &&
    description.includes("Origin: Pregame");
  return Boolean(hasPregameOrigin);
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
    // Individual service fields for pregame parsing
    equipmentServices: "",
    staffingServices: "",
    hireSecurity: "",

    ...partialBooking,
  };
};

export async function POST(request: Request) {
  try {
    const calendar = await getCalendarClient();

    // Get dryRun parameter from request body
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun === true;

    // Get tenant from request headers or default to 'mc'
    const tenant = request.headers.get("x-tenant") || "mc";

    // Get resources from tenant schema instead of collection
    const schema = await serverGetDocumentById(
      TableNames.TENANT_SCHEMA,
      tenant,
    );
    const resources =
      schema?.resources?.map((resource: any) => ({
        id: resource.roomId.toString(),
        calendarId: getCalendarId(resource),
        calendarStagingId: resource.calendarStagingId,
        calendarProdId: resource.calendarProdId,
        roomId: resource.roomId,
      })) || [];

    let totalNewBookings = 0;
    let existingBookings = 0;
    let targetBookings = 0;

    // For dry-run: collect information about what would be processed
    const dryRunResults: any[] = [];

    const now = new Date();
    const oneMonthsAgo = new Date(now.getFullYear(), now.getMonth(), 1);
    const fifthMonthsLater = new Date(
      now.getFullYear(),
      now.getMonth() + 12,
      0,
    );
    const timeMin = oneMonthsAgo.toISOString();
    const timeMax = fifthMonthsLater.toISOString();

    let count = 0;
    for (const resource of resources) {
      count++;
      //if (count > 1) {
      //  break;
      //}
      const calendarId = getCalendarId(resource);
      console.log("Resolved calendarId for room", resource.roomId, ":", calendarId);
      try {
        let pageToken: string | undefined;

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
          console.log("events", events);

          for (const event of events.data.items || []) {
            //Skip not pregame events
            console.log(event.summary);
            console.log(
              "Is it pregame event?",
              isPregameEvent(event.summary, event.description),
            );
            if (isPregameEvent(event.summary, event.description)) {
              const bookingRef = db
                .collection("bookings")
                .where("calendarEventId", "==", event.id);
              const bookingSnapshot = await bookingRef.get();
              const description = event.description || "";
              const parsedDetails = parseDescription(description);
              const guestEmails = findGuestEmails(event, description);
              const roomIds = findRoomIds(event.summary, description);
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
                existingBookings++;
                console.log(
                  `A Booking with title "${title}" and startDate "${event.start?.dateTime}" already exists.`,
                );

                const calendarEventId = event.id;
                const cleanEmail = guestEmails[0]
                  ? guestEmails[0].replace(/<[^>]*>/g, "").trim()
                  : "";

                if (!dryRun) {
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
                      calendarId: calendarId,
                      eventId: event.id!,
                      requestBody: {
                        summary: newTitle,
                      },
                    });
                  }
                }
                continue;
              }

              if (bookingSnapshot.empty && guestEmails) {
                targetBookings++;
                console.log("calendarEventId", event.id);
                console.log("title", event.summary);
                console.log("guestEmails[0]", guestEmails[0]);

                const calendarEventId = event.id;
                const cleanEmail = guestEmails[0]
                  ? guestEmails[0].replace(/<[^>]*>/g, "").trim()
                  : "";
                const newBooking = createBookingWithDefaults({
                  ...parsedDetails,
                  title: sanitizedTitle,
                  email: cleanEmail,
                  startDate: toFirebaseTimestampFromString(
                    event.start?.dateTime,
                  ) as Timestamp,
                  endDate: toFirebaseTimestampFromString(
                    event.end?.dateTime,
                  ) as Timestamp,
                  calendarEventId: calendarEventId || "",
                  roomId: roomIds,
                  requestNumber: await serverGetNextSequentialId("bookings"),
                });

                if (dryRun) {
                  dryRunResults.push(newBooking);
                  totalNewBookings++;
                } else {
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
                      calendarId: calendarId,
                      eventId: event.id,
                      requestBody: {
                        summary: newTitle,
                      },
                    });
                  }

                  console.log(
                    `New Booking created with ID: ${bookingDocRef.id}`,
                  );
                  totalNewBookings++;
                }
              } else if (bookingSnapshot.empty && !guestEmails) {
                console.log("No guest emails found");
              }
            }
          }
          pageToken = events.data.nextPageToken;
        } while (pageToken);
      } catch (error) {
        console.error(
          `Error processing calendar ${getCalendarId(resource)}:`,
          error,
        );
      }
    }

    console.log("targetBookings", targetBookings);
    console.log("totalNewBookings", totalNewBookings);

    if (dryRun) {
      return NextResponse.json(
        {
          message: `DRY RUN: Found ${dryRunResults.length} target bookings to process.`,
          dryRun: true,
          summary: {
            totalEvents: dryRunResults.length,
            newBookings: targetBookings,
            existingBookings: existingBookings,
            skippedBookings: dryRunResults.filter(r => r.result === "skipped")
              .length,
          },
          results: dryRunResults,
        },
        { status: 200 },
      );
    } else {
      return NextResponse.json(
        {
          message: `${totalNewBookings} new bookings have been synchronized. ${existingBookings} existing bookings have been updated with multiple rooms.`,
        },
        { status: 200 },
      );
    }
  } catch (error) {
    console.error("Error syncing calendars:", error);
    return NextResponse.json(
      { error: "An error occurred while syncing calendars." },
      { status: 500 },
    );
  }
}
