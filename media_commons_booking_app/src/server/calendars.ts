import { BookingFormDetails, RoomSetting } from '../types';

import { TableNames } from '../policy';
import { bookingContents } from './admin';
import { getAllActiveSheetRows } from './db';

export const addEventToCalendar = (
  calendarId: string,
  title: string,
  description: string,
  startTime: string,
  endTime: string,
  roomEmails: string[]
) => {
  const calendar = CalendarApp.getCalendarById(calendarId);
  console.log('calendar', calendar);

  const event = calendar.createEvent(
    title,
    new Date(startTime),
    new Date(endTime),
    {
      description,
    }
  );
  // @ts-expect-error GAS type doesn't match the documentation
  event.setColor(CalendarApp.EventColor.GRAY);
  //event.addGuest(guestEmail);
  roomEmails.forEach((roomEmail) => {
    event.addGuest(roomEmail);
  });
  console.log('event.id', event.getId());
  return event.getId();
};

export const confirmEvent = (calendarEventId: string) => {
  const event = CalendarApp.getEventById(calendarEventId);
  event.setTitle(event.getTitle().replace('[HOLD]', '[CONFIRMED]'));
  // @ts-expect-error GAS type doesn't match the documentation
  event.setColor(CalendarApp.EventColor.GREEN);
};

export const getCalendarEvents = (calendarId: string) => {
  var calendar = CalendarApp.getCalendarById(calendarId);
  var now = new Date();
  var threeMonthsFromNow = new Date();
  threeMonthsFromNow.setMonth(now.getMonth() + 3);
  var events = calendar.getEvents(now, threeMonthsFromNow);

  const formattedEvents = events.map((e) => {
    return {
      title: e.getTitle(),
      start: e.getStartTime().toISOString(),
      end: e.getEndTime().toISOString(),
    };
  });
  console.log('formattedEvents', formattedEvents[0]);
  return formattedEvents;
};

const getAllRoomCalendarIds = (): string[] => {
  const rows = getAllActiveSheetRows(TableNames.ROOMS);
  const ids = JSON.parse(rows).map((room: RoomSetting) =>
    process.env.CALENDAR_ENV === 'production'
      ? room.calendarIdProd
      : room.calendarIdDev
  );
  return ids;
};

export const inviteUserToCalendarEvent = (
  calendarEventId: string,
  guestEmail: string
) => {
  console.log(`Invite User: ${guestEmail}`);
  //TODO: getting roomId from booking sheet
  const roomCalendarIds = getAllRoomCalendarIds();
  roomCalendarIds.forEach((roomCalendarId) => {
    const calendar = CalendarApp.getCalendarById(roomCalendarId);
    const event = calendar.getEventById(calendarEventId);
    if (event) {
      event.addGuest(guestEmail);
      console.log(
        `Invited ${guestEmail} to room: ${roomCalendarId} event: ${calendarEventId}`
      );
    }
  });
};

const bookingContentsToDescription = (bookingContents: BookingFormDetails) => {
  const listItem = (key: string, value: string) => `<li>${key}: ${value}</li>`;
  let description = '<h3>Reservation Details</h3><ul>';
  const items = [
    listItem('Title', bookingContents.title),
    listItem('Description', bookingContents.description),
    listItem('Expected Attendance', bookingContents.expectedAttendance),
    bookingContents.roomSetup === 'yes' &&
      '**' + listItem('Room Setup', bookingContents.setupDetails) + '**',
    listItem('Title', bookingContents.title),
    bookingContents.mediaServices.length > 0 &&
      listItem('Media Services', bookingContents.mediaServices),
    bookingContents.mediaServicesDetails.length > 0 &&
      listItem('Media Services Details', bookingContents.mediaServicesDetails),
    (bookingContents.catering === 'yes' ||
      bookingContents.cateringService.length > 0) &&
      listItem('Catering', bookingContents.cateringService),
    bookingContents.hireSecurity === 'yes' &&
      listItem('Hire Security', bookingContents.hireSecurity),
    '</ul><h3>Cancellation Policy</h3>',
  ].filter((x: string | boolean) => x !== false);
  description = description.concat(...items);
  return description;
};

export const updateEventPrefix = (
  calendarEventId: string,
  newPrefix: string,
  bookingContents?: BookingFormDetails
) => {
  const roomCalendarIds = getAllRoomCalendarIds();
  //TODO: getting roomId from booking sheet
  roomCalendarIds.map((roomCalendarId) => {
    const calendar = CalendarApp.getCalendarById(roomCalendarId);
    const event = calendar.getEventById(calendarEventId);
    let description = bookingContents
      ? bookingContentsToDescription(bookingContents)
      : '';
    description +=
      'To cancel reservations please return to the Booking Tool, visit My Bookings, and click "cancel" on the booking at least 24 hours before the date of the event. Failure to cancel an unused booking is considered a no-show and may result in restricted use of the space.';
    if (event) {
      const prefix = /(?<=\[).+?(?=\])/g;
      event.setTitle(event.getTitle().replace(prefix, newPrefix));
      event.setDescription(description);
    }
  });
};
