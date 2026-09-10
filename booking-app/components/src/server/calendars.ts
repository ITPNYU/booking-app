import { bookingCalendarStrToDate } from "@/components/src/client/utils/date";
import { getCalendarClient } from "@/lib/googleClient";
import { getMcResourceServices } from "@/lib/tenant/mcResourceServices";
import { serverGetTenantResources } from "@/lib/tenant/serverGetTenantResources";
import { traceExternalCall } from "@/lib/newrelic-utils";
import { BookingFormDetails, BookingStatusLabel } from "../types";
import { formatOrigin, getSecondaryContactName } from "../utils/formatters";
import {
  formatServicesDescriptionHtml,
  getBookingServicesByRoom,
  type BookingServicesSource,
} from "../utils/bookingServicesDisplay";
import type { ServiceResourceLike } from "../utils/resourceServicesUtils";

import { serverGetRoomCalendarIds } from "./admin";

async function resourcesForServicesDisplay(
  bookingContents: BookingFormDetails,
  tenant?: string,
): Promise<ServiceResourceLike[]> {
  const tenantResources = await serverGetTenantResources(tenant);
  const annexByRoom = bookingContents.annexByRoom;
  const fallbackRooms =
    annexByRoom && typeof annexByRoom === "object"
      ? Object.keys(annexByRoom).map((roomId) => ({
          resourceId: roomId,
          services: getMcResourceServices(roomId) ?? {},
        }))
      : [];
  return [...tenantResources, ...fallbackRooms];
}

export const patchCalendarEvent = async (
  event: any,
  calendarId: string,
  eventId: string,
  body: any,
) => {
  const calendar = await getCalendarClient();
  const requestBody = {
    start: event.start,
    end: event.end,
    ...body,
  };
  await traceExternalCall("GoogleCalendar", "events.patch", () =>
    calendar.events.patch({
      calendarId,
      eventId,
      requestBody,
      sendUpdates: "all", // Send notifications to all attendees when calendar is updated
    }),
  );
};

export const inviteUserToCalendarEvent = async (
  calendarEventId: string,
  guestEmail: string,
  roomId: string,
  tenant?: string,
) => {
  const roomCalendarIds = await serverGetRoomCalendarIds(roomId, tenant);
  const calendar = await getCalendarClient();

  for (const roomCalendarId of roomCalendarIds) {
    try {
      const event = await traceExternalCall("GoogleCalendar", "events.get", () =>
        calendar.events.get({
          calendarId: roomCalendarId,
          eventId: calendarEventId,
        }),
      );

      if (event) {
        const eventData = event.data;
        const attendees = event.data.attendees || [];
        attendees.push({ email: guestEmail });
        await patchCalendarEvent(event, roomCalendarId, calendarEventId, {
          attendees,
        });

        console.log(
          `Invited ${guestEmail} to room: ${roomCalendarId} event: ${calendarEventId}`,
        );
      }
    } catch (error) {
      console.error(
        `Error inviting ${guestEmail} to event ${calendarEventId} in calendar ${roomCalendarId}:`,
        error,
      );
    }
  }
};

export const bookingContentsToDescription = async (
  bookingContents: BookingFormDetails,
  tenant?: string,
) => {
  const listItem = (key: string, value: string) => {
    const displayValue =
      value === "no" || value === "No" ? "none" : value || "none";
    return `<li><strong>${key}:</strong> ${displayValue}</li>`;
  };

  let description = "";

  // Helper function to safely get property value
  const getProperty = (obj: any, key: string): string =>
    obj[key]?.toString() || "";

  // Use shared status resolver
  const { getStatusFromXState } =
    await import("@/components/src/utils/statusFromXState");

  // Request Section
  description += "<h3>Request</h3><ul>";
  description += listItem(
    "Request #",
    getProperty(bookingContents, "requestNumber"),
  );
  description += listItem("Room(s)", getProperty(bookingContents, "roomId"));
  description += listItem("Date", getProperty(bookingContents, "startDate"));
  description += listItem(
    "Time",
    `${getProperty(bookingContents, "startTime")} - ${getProperty(bookingContents, "endTime")}`,
  );
  description += listItem(
    "Status",
    getStatusFromXState(bookingContents as any, tenant),
  );
  description += listItem(
    "Origin",
    formatOrigin(getProperty(bookingContents, "origin")),
  );
  description += "</ul>";

  // Requester Section
  description += "<h3>Requester</h3><ul>";
  description += listItem("NetID", getProperty(bookingContents, "netId"));
  description += listItem(
    "Name",
    `${getProperty(bookingContents, "firstName")} ${getProperty(bookingContents, "lastName")}`.trim() ||
      "",
  );
  description += listItem(
    "School",
    getProperty(bookingContents, "school") === "Other" &&
      getProperty(bookingContents, "otherSchool")
      ? getProperty(bookingContents, "otherSchool")
      : getProperty(bookingContents, "school"),
  );
  description += listItem(
    "Department",
    getProperty(bookingContents, "department") === "Other" &&
      getProperty(bookingContents, "otherDepartment")
      ? getProperty(bookingContents, "otherDepartment")
      : getProperty(bookingContents, "department"),
  );
  description += listItem("Role", getProperty(bookingContents, "role"));
  description += listItem("Email", getProperty(bookingContents, "email"));
  description += listItem("Phone", getProperty(bookingContents, "phoneNumber"));
  description += listItem("N-Number", getProperty(bookingContents, "nNumber"));
  description += listItem(
    "Secondary Contact",
    getSecondaryContactName(bookingContents)
  );
  description += listItem(
    "Secondary Contact Email",
    getProperty(bookingContents, "secondaryEmail")
  );
  description += listItem(
    "Sponsor Name",
    `${getProperty(bookingContents, "sponsorFirstName")} ${getProperty(bookingContents, "sponsorLastName")}`.trim() ||
      "",
  );
  description += listItem(
    "Sponsor Email",
    getProperty(bookingContents, "sponsorEmail"),
  );
  description += "</ul>";

  // Details Section
  description += "<h3>Details</h3><ul>";
  description += listItem("Title", getProperty(bookingContents, "title"));
  description += listItem(
    "Description",
    getProperty(bookingContents, "description"),
  );
  description += listItem(
    "Booking Type",
    getProperty(bookingContents, "bookingType"),
  );
  description += listItem(
    "Expected Attendance",
    getProperty(bookingContents, "expectedAttendance"),
  );
  description += listItem(
    "Attendee Affiliation",
    getProperty(bookingContents, "attendeeAffiliation"),
  );
  description += "</ul>";

  const resources = await resourcesForServicesDisplay(bookingContents, tenant);
  const servicesDisplay = getBookingServicesByRoom(
    bookingContents as BookingServicesSource,
    resources,
  );
  const cartNumber = getProperty(bookingContents, "webcheckoutCartNumber");
  if (cartNumber) {
    servicesDisplay.bookingLevel.push({
      key: "cart",
      label: "Cart Number",
      value: cartNumber,
    });
  }
  description += formatServicesDescriptionHtml(servicesDisplay);

  description += "<h3>Cancellation Policy</h3>";

  return description;
};

type InsertEventType = {
  calendarId: string;
  title: string;
  description: string;
  startTime: string | number | Date;
  endTime: string | number | Date;
  roomEmails: string[];
};

// Booking times arrive as client strings; offset-less ones are Eastern wall
// times from stale bundles and must not be parsed in the host timezone.
const toEventInstant = (time: string | number | Date): Date =>
  typeof time === "string" ? bookingCalendarStrToDate(time) : new Date(time);

export const insertEvent = async ({
  calendarId,
  title,
  description,
  startTime,
  endTime,
  roomEmails,
}: InsertEventType) => {
  const calendar = await getCalendarClient();
  try {
    const event = await traceExternalCall(
      "GoogleCalendar",
      "events.insert",
      () =>
        calendar.events.insert({
          calendarId,
          sendUpdates: "all", // Send notifications to all attendees when calendar event is created
          requestBody: {
            summary: title,
            description,
            start: {
              dateTime: toEventInstant(startTime).toISOString(),
            },
            end: {
              dateTime: toEventInstant(endTime).toISOString(),
            },
            attendees: roomEmails.map((email: string) => ({ email })),
          },
        }),
    );
    return event.data;
  } catch (error: any) {
    // Log the raw inputs and the Google error body; the generic gaxios
    // "Bad Request" message alone is not actionable when this fails in prod
    console.error("🚨 GOOGLE CALENDAR EVENT INSERT FAILED:", {
      calendarId,
      rawStartTime: String(startTime),
      rawEndTime: String(endTime),
      roomEmails,
      titleLength: title?.length ?? 0,
      descriptionLength: description?.length ?? 0,
      googleStatus: error?.response?.status ?? error?.code,
      googleError: JSON.stringify(
        error?.response?.data ?? error?.errors ?? error?.message,
      ),
    });
    throw error;
  }
};

export const updateCalendarEvent = async (
  calendarEventId: string,
  newValues: {
    end?: {
      dateTime: string;
    };
    statusPrefix?: BookingStatusLabel;
  },
  bookingContents?: BookingFormDetails,
  tenant?: string,
) => {
  if (!bookingContents) {
    console.error("No booking contents provided for calendar event update");
    return;
  }

  const roomCalendarIds = await serverGetRoomCalendarIds(
    String(bookingContents.roomId).split(",")[0].trim(),
    tenant,
  );
  console.log(`Room Calendar Ids: ${roomCalendarIds}`);
  console.log("bookingContents", bookingContents);
  const calendar = await getCalendarClient();

  for (const roomCalendarId of roomCalendarIds) {
    try {
      const event = await traceExternalCall("GoogleCalendar", "events.get", () =>
        calendar.events.get({
          calendarId: roomCalendarId,
          eventId: calendarEventId,
        }),
      );

      if (!event) {
        throw new Error("event not found with specified id");
      }

      const updatedValues = {};

      if (newValues.statusPrefix) {
        const eventData = event.data;
        const eventTitle = eventData.summary ?? "";
        const prefixRegex = /\[.*?\]/g;
        const newTitle = eventTitle.replace(
          prefixRegex,
          `[${newValues.statusPrefix}]`,
        );
        updatedValues["summary"] = newTitle;
      }

      if (newValues.end) {
        updatedValues["end"] = newValues.end;
      }

      let description = await bookingContentsToDescription(
        bookingContents,
        tenant,
      );
      description +=
        'To cancel reservations please return to the Booking Tool, visit My Bookings, and click "cancel" on the booking at least 24 hours before the date of the event. Failure to cancel an unused booking is considered a no-show and may result in restricted use of the space.';
      updatedValues["description"] = description;

      await patchCalendarEvent(
        event,
        roomCalendarId,
        calendarEventId,
        updatedValues,
      );

      console.log(
        `Updated event ${calendarEventId} in calendar ${roomCalendarId} with new values: ${JSON.stringify(newValues)}`,
      );
    } catch (error) {
      console.error(
        "Error updating event %s in calendar %s:",
        calendarEventId,
        roomCalendarId,
        error,
      );
    }
  }
};

export const deleteEvent = async (
  calendarId: string,
  calendarEventId: string,
  roomId?: string,
) => {
  const calendar = await getCalendarClient();
  try {
    await traceExternalCall("GoogleCalendar", "events.delete", () =>
      calendar.events.delete({
        calendarId,
        eventId: calendarEventId,
        sendUpdates: "all", // Send cancellation notifications to all attendees
      }),
    );
    console.log(`deleted calendar event for ${roomId}`);
  } catch (error) {
    console.log(`calendar event doesn't exist for room ${roomId}`);
  }
};

export const updateByCalendarEventId = async (
  calendarEventId: string,
  newValues: any,
) => {
  // const allRooms: RoomSetting[] = await clientFetchAllDataFromCollection(
  //   TableNames.RESOURCES
  // );
  // const roomCalendarIds = allRooms.map((room) => room.calendarId);
  // // const calendarIdsToEvent = {};
  // const calendar = await getCalendarClient();
  // for (const roomCalendarId of roomCalendarIds) {
  //   const event = await calendar.events.get({
  //     calendarId: roomCalendarId,
  //     eventId: calendarEventId,
  //   });
  //   await patchCalendarEvent(event, roomCalendarId, calendarEventId, newValues);
  // }
};

// update endTime for all calendar events
// searchCalendarsForEventId(id);
// const roomCalendarIdsToEvents = await searchCalendarsForEventId(id);
// for (let [calendarId, event] of Object.entries(roomCalendarIdsToEvents)) {
//   await patchCalendarEvent(event, calendarId, id, {
//     end: {
//       dateTime: checkoutDate.toISOString(),
//     },
//   });
//   console.log(`Updated end time on ${calendarId} event: ${id}`);
// }
