import { BookingFormDetails, BookingStatusLabel } from "../types";

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

const bookingContentsToDescription = (bookingContents: BookingFormDetails) => {
  const listItem = (key: string, value: string) => `<li>${key}: ${value}</li>`;
  let description = "<h3>Reservation Details</h3><ul>";
  const items = [
    listItem("Title", bookingContents.title),
    listItem("Description", bookingContents.description),
    listItem("Expected Attendance", bookingContents.expectedAttendance),
    bookingContents.roomSetup === "yes" &&
      "**" + listItem("Room Setup", bookingContents.setupDetails) + "**",
    bookingContents.mediaServices && bookingContents.mediaServices.length > 0
      ? listItem("Media Services", bookingContents.mediaServices)
      : "",
    bookingContents.mediaServicesDetails.length > 0
      ? listItem("Media Services Details", bookingContents.mediaServicesDetails)
      : "",
    bookingContents.catering === "yes" ||
    bookingContents.cateringService.length > 0
      ? listItem("Catering", bookingContents.cateringService)
      : "",
    bookingContents.hireSecurity === "yes"
      ? listItem("Hire Security", bookingContents.hireSecurity)
      : "",
    "</ul><h3>Cancellation Policy</h3>",
  ];
  //@ts-ignore
  description = description.concat(...items);
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
      colorId: "8", // Gray
    },
  });
  return event.data;
};

export const updateCalendarEvent = async (
  calendarEventId: string,
  newValues: {
    end: {
      dateTime: string;
    };
    statusPrefix?: BookingStatusLabel;
  },
  bookingContents: BookingFormDetails
) => {
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

      let description = bookingContents
        ? bookingContentsToDescription(bookingContents)
        : "";
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
        `Error updating event ${calendarEventId} in calendar ${roomCalendarId}:`,
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
