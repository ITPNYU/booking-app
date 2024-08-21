import { BookingFormDetails, BookingStatusLabel, RoomSetting } from "../types";
import { Timestamp, endAt, sum, where } from "@firebase/firestore";

import { TableNames } from "../policy";
import { fetchAllDataFromCollection } from "@/lib/firebase/firebase";
import { getCalendarClient } from "@/lib/googleClient";

export const getRoomCalendarIds = async (roomId: number): Promise<string[]> => {
  const queryConstraints = [where("roomId", "==", roomId)];
  const rooms = await fetchAllDataFromCollection(
    TableNames.RESOURCES,
    queryConstraints
  );
  console.log(`Rooms: ${rooms}`);
  return rooms.map((room: any) => room.calendarId);
};

export const getRoomCalendarId = async (
  roomId: number
): Promise<string | null> => {
  const queryConstraints = [where("roomId", "==", roomId)];
  const rooms = await fetchAllDataFromCollection(
    TableNames.RESOURCES,
    queryConstraints
  );
  if (rooms.length > 0) {
    const room = rooms[0] as RoomSetting;
    console.log(`Room: ${JSON.stringify(room)}`);
    return room.calendarId;
  } else {
    console.log("No matching room found.");
    return null;
  }
};

const patchCalendarEvent = async (
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
  const roomCalendarIds = await getRoomCalendarIds(roomId);
  const calendar = await getCalendarClient();

  for (const roomCalendarId of roomCalendarIds) {
    try {
      const event = await calendar.events.get({
        calendarId: roomCalendarId,
        eventId: calendarEventId,
      });
      console.log("event", event);

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
    listItem("Title", bookingContents.title),
    bookingContents.mediaServices &&
      bookingContents.mediaServices.length > 0 &&
      listItem("Media Services", bookingContents.mediaServices),
    bookingContents.mediaServicesDetails.length > 0 &&
      listItem("Media Services Details", bookingContents.mediaServicesDetails),
    (bookingContents.catering === "yes" ||
      bookingContents.cateringService.length > 0) &&
      listItem("Catering", bookingContents.cateringService),
    bookingContents.hireSecurity === "yes" &&
      listItem("Hire Security", bookingContents.hireSecurity),
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
  console.log("inseerted event", event);
  return event.data;
};

export const updateEventPrefix = async (
  calendarEventId: string,
  newPrefix: BookingStatusLabel,
  bookingContents: BookingFormDetails
) => {
  const roomCalendarIds = await getRoomCalendarIds(
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
      console.log("event", event);

      if (event) {
        const eventData = event.data;
        const eventTitle = eventData.summary ?? "";
        const prefixRegex = /\[.*?\]/g;
        const newTitle = eventTitle.replace(prefixRegex, `[${newPrefix}]`);

        let description = bookingContents
          ? bookingContentsToDescription(bookingContents)
          : "";
        description +=
          'To cancel reservations please return to the Booking Tool, visit My Bookings, and click "cancel" on the booking at least 24 hours before the date of the event. Failure to cancel an unused booking is considered a no-show and may result in restricted use of the space.';

        await patchCalendarEvent(event, roomCalendarId, calendarEventId, {
          summary: newTitle,
          description: description,
        });

        console.log(
          `Updated event ${calendarEventId} in calendar ${roomCalendarId} with new prefix ${newPrefix}`
        );
      }
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
