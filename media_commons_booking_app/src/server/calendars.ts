import { RoomSetting } from '../types';
import { TableNames } from '../policy';
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

export const updateEventPrefix = (
  calendarEventId: string,
  newPrefix: string
) => {
  const roomCalendarIds = getAllRoomCalendarIds();
  //TODO: getting roomId from booking sheet
  roomCalendarIds.map((roomCalendarId) => {
    const calendar = CalendarApp.getCalendarById(roomCalendarId);
    const event = calendar.getEventById(calendarEventId);
    const description =
      ' Cancellation Policy: To cancel reservations please email the Media Commons Team(mediacommons.reservations@nyu.edu) at least 24 hours before the date of the event. Failure to cancel may result in restricted use of event spaces.';
    if (event) {
      const prefix = /(?<=\[).+?(?=\])/g;
      event.setTitle(event.getTitle().replace(prefix, newPrefix));
      event.setDescription(description);
    }
  });
};
