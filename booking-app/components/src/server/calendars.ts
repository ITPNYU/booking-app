import { BookingFormDetails, BookingStatusLabel } from "../types";
import { formatOrigin, getSecondaryContactName } from "../utils/formatters";

import { getCalendarClient } from "@/lib/googleClient";
import { serverGetRoomCalendarIds } from "./admin";

export const patchCalendarEvent = async (
  event: any,
  calendarId: string,
  eventId: string,
  body: any
) => {
  const calendar = await getCalendarClient();
  const requestBody = {
    start: event.start,
    end: event.end,
    ...body,
  };
  await calendar.events.patch({
    calendarId: calendarId,
    eventId: eventId,
    requestBody: requestBody,
  });
};

export const inviteUserToCalendarEvent = async (
  calendarEventId: string,
  guestEmail: string,
  roomId: number
) => {
  const roomCalendarIds = await serverGetRoomCalendarIds(roomId);
  const calendar = await getCalendarClient();

  for (const roomCalendarId of roomCalendarIds) {
    try {
      const event = await calendar.events.get({
        calendarId: roomCalendarId,
        eventId: calendarEventId,
      });

      if (event) {
        const eventData = event.data;
        const attendees = event.data.attendees || [];
        attendees.push({ email: guestEmail });
        await patchCalendarEvent(event, roomCalendarId, calendarEventId, {
          attendees: attendees,
        });

        console.log(
          `Invited ${guestEmail} to room: ${roomCalendarId} event: ${calendarEventId}`
        );
      }
    } catch (error) {
      console.error(
        `Error inviting ${guestEmail} to event ${calendarEventId} in calendar ${roomCalendarId}:`,
        error
      );
    }
  }
};

export const bookingContentsToDescription = async (
  bookingContents: BookingFormDetails,
  tenant?: string
) => {
  const listItem = (key: string, value: string) => {
    const displayValue =
      value === "no" || value === "No" ? "none" : value || "none";
    return `<li><strong>${key}:</strong> ${displayValue}</li>`;
  };

  let description = "";

  // Helper function to safely get property value
  const getProperty = (obj: any, key: string): string => {
    return obj[key]?.toString() || "";
  };

  // Use shared status resolver
  const { getStatusFromXState } = await import(
    "@/components/src/utils/statusFromXState"
  );

  // Request Section
  description += "<h3>Request</h3><ul>";
  description += listItem(
    "Request #",
    getProperty(bookingContents, "requestNumber")
  );
  description += listItem("Room(s)", getProperty(bookingContents, "roomId"));
  description += listItem("Date", getProperty(bookingContents, "startDate"));
  description += listItem(
    "Time",
    `${getProperty(bookingContents, "startTime")} - ${getProperty(bookingContents, "endTime")}`
  );
  description += listItem(
    "Status",
    getStatusFromXState(bookingContents as any, tenant)
  );
  description += listItem(
    "Origin",
    formatOrigin(getProperty(bookingContents, "origin"))
  );
  description += "</ul>";

  // Requester Section
  description += "<h3>Requester</h3><ul>";
  description += listItem("NetID", getProperty(bookingContents, "netId"));
  description += listItem(
    "Name",
    `${getProperty(bookingContents, "firstName")} ${getProperty(bookingContents, "lastName")}`.trim() ||
      ""
  );
  description += listItem(
    "School",
    getProperty(bookingContents, "school") === "Other" &&
      getProperty(bookingContents, "otherSchool")
      ? getProperty(bookingContents, "otherSchool")
      : getProperty(bookingContents, "school")
  );
  description += listItem(
    "Department",
    getProperty(bookingContents, "department") === "Other" &&
      getProperty(bookingContents, "otherDepartment")
      ? getProperty(bookingContents, "otherDepartment")
      : getProperty(bookingContents, "department")
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
      ""
  );
  description += listItem(
    "Sponsor Email",
    getProperty(bookingContents, "sponsorEmail")
  );
  description += "</ul>";

  // Details Section
  description += "<h3>Details</h3><ul>";
  description += listItem("Title", getProperty(bookingContents, "title"));
  description += listItem(
    "Description",
    getProperty(bookingContents, "description")
  );
  description += listItem(
    "Booking Type",
    getProperty(bookingContents, "bookingType")
  );
  description += listItem(
    "Expected Attendance",
    getProperty(bookingContents, "expectedAttendance")
  );
  description += listItem(
    "Attendee Affiliation",
    getProperty(bookingContents, "attendeeAffiliation")
  );
  description += "</ul>";

  // Services Section
  description += "<h3>Services</h3><ul>";
  description += listItem(
    "Room Setup",
    getProperty(bookingContents, "setupDetails") ||
      getProperty(bookingContents, "roomSetup")
  );
  if (getProperty(bookingContents, "chartFieldForRoomSetup")) {
    description += listItem(
      "Room Setup Chart Field",
      getProperty(bookingContents, "chartFieldForRoomSetup")
    );
  }
  // Only show equipment service if it exists
  const equipmentServices = getProperty(bookingContents, "equipmentServices");
  if (equipmentServices) {
    description += listItem("Equipment Service", equipmentServices);
    const equipmentDetails = getProperty(
      bookingContents,
      "equipmentServicesDetails"
    );
    if (equipmentDetails) {
      description += listItem("Equipment Service Details", equipmentDetails);
    }
  }

  // Only show staffing service if it exists
  const staffingServices = getProperty(bookingContents, "staffingServices");
  if (staffingServices) {
    description += listItem("Staffing Service", staffingServices);
    const staffingDetails = getProperty(
      bookingContents,
      "staffingServicesDetails"
    );
    if (staffingDetails) {
      description += listItem("Staffing Service Details", staffingDetails);
    }
  }

  // Add WebCheckout Cart Number
  const cartNumber = getProperty(bookingContents, "webcheckoutCartNumber");
  if (cartNumber) {
    description += listItem("Cart Number", cartNumber);
  }

  // Only show catering service if it's not "no" or "No"
  const cateringService =
    getProperty(bookingContents, "cateringService") ||
    getProperty(bookingContents, "catering");
  if (cateringService && cateringService !== "no" && cateringService !== "No") {
    description += listItem("Catering Service", cateringService);
    const cateringChartField = getProperty(
      bookingContents,
      "chartFieldForCatering"
    );
    if (cateringChartField) {
      description += listItem("Catering Chart Field", cateringChartField);
    }
  }

  // Only show cleaning service if it's not "no" or "No"
  const cleaningService = getProperty(bookingContents, "cleaningService");
  if (cleaningService && cleaningService !== "no" && cleaningService !== "No") {
    description += listItem("Cleaning Service", "Yes");
    const cleaningChartField = getProperty(
      bookingContents,
      "chartFieldForCleaning"
    );
    if (cleaningChartField) {
      description += listItem(
        "Cleaning Service Chart Field",
        cleaningChartField
      );
    }
  }

  // Only show security service if it's not "no" or "No"
  const securityService = getProperty(bookingContents, "hireSecurity");
  if (securityService && securityService !== "no" && securityService !== "No") {
    description += listItem("Security", securityService);
    const securityChartField = getProperty(
      bookingContents,
      "chartFieldForSecurity"
    );
    if (securityChartField) {
      description += listItem("Security Chart Field", securityChartField);
    }
  }
  description += "</ul>";

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
export const insertEvent = async ({
  calendarId,
  title,
  description,
  startTime,
  endTime,
  roomEmails,
}: InsertEventType) => {
  const calendar = await getCalendarClient();
  const event = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: title,
      description,
      start: {
        dateTime: new Date(startTime).toISOString(),
      },
      end: {
        dateTime: new Date(endTime).toISOString(),
      },
      attendees: roomEmails.map((email: string) => ({ email })),
    },
  });
  return event.data;
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
  tenant?: string
) => {
  if (!bookingContents) {
    console.error("No booking contents provided for calendar event update");
    return;
  }

  const roomCalendarIds = await serverGetRoomCalendarIds(
    typeof bookingContents.roomId == "string"
      ? parseInt(bookingContents.roomId, 10)
      : bookingContents.roomId
  );
  console.log(`Room Calendar Ids: ${roomCalendarIds}`);
  console.log("bookingContents", bookingContents);
  const calendar = await getCalendarClient();

  for (const roomCalendarId of roomCalendarIds) {
    try {
      const event = await calendar.events.get({
        calendarId: roomCalendarId,
        eventId: calendarEventId,
      });

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
          `[${newValues.statusPrefix}]`
        );
        updatedValues["summary"] = newTitle;
      }

      if (newValues.end) {
        updatedValues["end"] = newValues.end;
      }

      let description = await bookingContentsToDescription(
        bookingContents,
        tenant
      );
      description +=
        'To cancel reservations please return to the Booking Tool, visit My Bookings, and click "cancel" on the booking at least 24 hours before the date of the event. Failure to cancel an unused booking is considered a no-show and may result in restricted use of the space.';
      updatedValues["description"] = description;

      await patchCalendarEvent(
        event,
        roomCalendarId,
        calendarEventId,
        updatedValues
      );

      console.log(
        `Updated event ${calendarEventId} in calendar ${roomCalendarId} with new values: ${JSON.stringify(newValues)}`
      );
    } catch (error) {
      console.error(
        "Error updating event %s in calendar %s:",
        calendarEventId,
        roomCalendarId,
        error
      );
    }
  }
};

export const deleteEvent = async (
  calendarId: string,
  calendarEventId: string,
  roomId?: string
) => {
  const calendar = await getCalendarClient();
  try {
    await calendar.events.delete({
      calendarId,
      eventId: calendarEventId,
    });
    console.log("deleted calendar event for " + roomId);
  } catch (error) {
    console.log("calendar event doesn't exist for room " + roomId);
  }
};

export const updateByCalendarEventId = async (
  calendarEventId: string,
  newValues: any
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
