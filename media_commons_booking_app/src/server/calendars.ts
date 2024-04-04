// export const getEvents = async (calendarId: string, startCalendarDate, endCalendarDate) => {
//   const calendar = CalendarApp.getCalendarById(calendarId);
//   const startDate = new Date(startCalendarDate);
//   const endDate = new Date(endCalendarDate);

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

export const confirmEvent = (calendarId: string) => {
  const event = CalendarApp.getEventById(calendarId);
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

const allRoomIds = () => {
  const rows = getAllActiveSheetRows(TableNames.ROOMS);
  const ids = JSON.parse(rows).map((row: RoomSetting) => row.calendarId);
  return ids;
};

export const inviteUserToCalendarEvent = (
  eventId: string,
  guestEmail: string
) => {
  console.log(`Invite User: ${guestEmail}`);
  //TODO: getting roomId from booking sheet
  const roomIds = allRoomIds();
  roomIds.forEach((roomId) => {
    const calendar = CalendarApp.getCalendarById(roomId);
    const event = calendar.getEventById(eventId);
    if (event) {
      event.addGuest(guestEmail);
      console.log(`Invited ${guestEmail} to room: ${roomId} event: ${eventId}`);
    }
  });
};

export const updateEventPrefix = (id: string, newPrefix: string) => {
  const roomIds = allRoomIds();
  //TODO: getting roomId from booking sheet
  roomIds.map((roomId) => {
    const calendar = CalendarApp.getCalendarById(roomId);
    const event = calendar.getEventById(id);
    const description =
      ' Cancellation Policy: To cancel reservations please email the Media Commons Team(mediacommons.reservations@nyu.edu) at least 24 hours before the date of the event. Failure to cancel may result in restricted use of event spaces.';
    if (event) {
      const prefix = /(?<=\[).+?(?=\])/g;
      event.setTitle(event.getTitle().replace(prefix, newPrefix));
      event.setDescription(description);
    }
  });
};
