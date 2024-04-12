import {
  BookingStatusLabel,
  CalendarEvent,
  RoomSetting,
} from '../../../../types';
import React, { useEffect, useState } from 'react';

import { DateSelectArg } from '@fullcalendar/core';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import googleCalendarPlugin from '@fullcalendar/google-calendar';
import interactionPlugin from '@fullcalendar/interaction'; // for selectable
import { serverFunctions } from '../../../utils/serverFunctions';
import timeGridPlugin from '@fullcalendar/timegrid'; // a plugin!
import { HIDING_STATUS } from '../../../../policy';

const TITLE_TAG = '[Click to Delete]';

interface Props {
  allRooms: RoomSetting[];
  bookingTimeEvent: DateSelectArg;
  isOverlap: (x: DateSelectArg) => boolean;
  room: RoomSetting;
  selectedRooms: RoomSetting[];
  setBookingTimeEvent: (x: DateSelectArg) => void;
}

export const RoomCalendar = ({
  room,
  selectedRooms,
  allRooms,
  bookingTimeEvent,
  setBookingTimeEvent,
  isOverlap,
}: Props) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    console.log(
      'Fetching calendar events from:',
      process.env.CALENDAR_ENV,
      'calendars'
    );
    fetchCalendarEvents(
      process.env.CALENDAR_ENV === 'production'
        ? room.calendarIdProd
        : room.calendarIdDev
    );
  }, []);

  function renderEventContent(eventInfo) {
    const match = eventInfo.event.title.match(/\[(.*?)\]/);
    const title = match ? match[1] : eventInfo.event.title;

    const startTime = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(eventInfo.event.start);
    const endTime = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(eventInfo.event.end);

    let backgroundColor = '';
    // Change the background color of the event depending on its title
    if (eventInfo.event.title.includes(BookingStatusLabel.REQUESTED)) {
      backgroundColor = '#d60000';
    } else if (
      eventInfo.event.title.includes(BookingStatusLabel.PRE_APPROVED)
    ) {
      backgroundColor = '#f6c026';
    } else if (eventInfo.event.title.includes(BookingStatusLabel.APPROVED)) {
      backgroundColor = '#33b679';
    }
    return (
      <div
        style={{
          backgroundColor: backgroundColor,
          height: '100%',
          width: '100%',
        }}
      >
        <b>{title}</b>
      </div>
    );
  }

  const fetchCalendarEvents = async (calendarId) => {
    serverFunctions.getCalendarEvents(calendarId).then((rows) => {
      const filteredEvents = rows.filter((row) => {
        return !HIDING_STATUS.some((status) => row.title.includes(status));
      });
      setEvents(filteredEvents);
    });
  };

  const handleEventClick = (info) => {
    if (!editableEvent(info.event)) return;
    const targetGroupId = info.event.groupId;
    const isConfirmed = window.confirm('Do you want to delete this event?');

    if (isConfirmed) {
      allRooms.map((room) => {
        if (!room.calendarRef.current) return;
        let calendarApi = room.calendarRef.current.getApi();
        const events = calendarApi.getEvents();
        events.map((event) => {
          if (event.groupId === targetGroupId) {
            event.remove();
          }
        });
      });
      setBookingTimeEvent(null);
      return;
    }
  };
  const handleDateSelect = (selectInfo) => {
    if (bookingTimeEvent) {
      alert('You can only book one time slot per reservation');
      return;
    }
    allRooms.map((room) => {
      console.log('handle datae select room', room);
      if (!room.calendarRef.current) return;
      let calendarApi = room.calendarRef.current.getApi();
      calendarApi.addEvent({
        id: Date.now(), // Generate a unique ID for the event
        start: selectInfo.startStr,
        end: selectInfo.endStr,
        title: `${TITLE_TAG}`,
        groupId: selectInfo.startStr,
      });
    });
    setBookingTimeEvent(selectInfo);
  };
  const handleSelectAllow = (selectInfo) => {
    console.log('isOverlap', !isOverlap(selectInfo));
    return !isOverlap(selectInfo);
  };

  const syncEventLengthAcrossCalendars = (changedEvent) => {
    allRooms.forEach((room) => {
      const targetGroupId = changedEvent.groupId;
      if (room.calendarRef.current) {
        let calendarApi = room.calendarRef.current.getApi();
        const events = calendarApi.getEvents();
        events.map((event) => {
          //All events are retrieved, so change only for the event retrieved this time.
          if (event.groupId === targetGroupId) {
            event.setStart(changedEvent.start);
            event.setEnd(changedEvent.end);
          }
        });
      }
    });
    setBookingTimeEvent(changedEvent);
  };
  const editableEvent = (info) => {
    return info.title.includes(TITLE_TAG);
  };
  return (
    <div
      className={`mx-5 h-[1000px] ${
        selectedRooms.length === 1 && 'w-[1000px]'
      } ${!selectedRooms.includes(room) && 'hidden'}`}
    >
      {selectedRooms.includes(room)}
      {room.roomId} {room.name}
      <FullCalendar
        ref={room.calendarRef}
        height="100%"
        selectable={true}
        events={events}
        plugins={[
          interactionPlugin,
          timeGridPlugin,
          googleCalendarPlugin,
          dayGridPlugin,
        ]}
        headerToolbar={{
          left: '',
          center: 'title',
          right: '',
        }}
        themeSystem="bootstrap5"
        eventContent={renderEventContent}
        editable={true}
        initialView={selectedRooms.length > 1 ? 'timeGridDay' : 'timeGridDay'}
        navLinks={true}
        select={function (info) {
          handleDateSelect(info);
        }}
        eventClick={function (info) {
          info.jsEvent.preventDefault();
          handleEventClick(info);
        }}
        eventAllow={(dropLocation, draggedEvent) => {
          return editableEvent(draggedEvent);
        }}
        selectAllow={(e) => handleSelectAllow(e)}
        eventResize={(info) => {
          syncEventLengthAcrossCalendars(info.event);
        }}
        eventDrop={(info) => {
          syncEventLengthAcrossCalendars(info.event);
        }}
      />
    </div>
  );
};
