import React, { useState, useEffect, useRef } from 'react';
import { CalendarDatePicker } from './CalendarDatePicker';
import { DateSelectArg } from '@fullcalendar/core';
import { Role, RoomSetting } from './SheetEditor';
import { formatDate } from '../../utils/date';
import { RoomCalendar } from './RoomCalendar';

type CalendarProps = {
  allRooms: any[];
  selectedRooms: RoomSetting[];
  handleSetDate: any;
  refs?: any[];
  canBookFullTime: Boolean;
};

const TITLE_TAG = '[Click to Delete]';

export const Calendars = ({
  allRooms,
  selectedRooms,
  handleSetDate,
  canBookFullTime,
}: CalendarProps) => {
  console.log('allrooms', allRooms);
  const [bookingTimeEvent, setBookingTimeEvent] = useState<DateSelectArg>();
  const isOverlap = (info) => {
    return selectedRooms.some((room, i) => {
      const calendarApi = room.calendarRef.current.getApi();

      const allEvents = calendarApi.getEvents();
      return allEvents.some((event) => {
        if (event.title.includes(TITLE_TAG)) return false;
        return (
          (event.start >= info.start && event.start < info.end) ||
          (event.end > info.start && event.end <= info.end) ||
          (event.start <= info.start && event.end >= info.end)
        );
      });
    });
  };

  const validateEvents = (e) => {
    e.stopPropagation;
    const overlap = isOverlap(bookingTimeEvent);
    const past = bookingTimeEvent.start < new Date();
    if (past) {
      alert("You can't schedule events in the past");
      return;
    }

    if (overlap) {
      alert('The new event overlaps with an existing event on the same day!');
      return;
    }
    if (bookingTimeEvent) {
      const isConfirmed = window.confirm(
        `Confirming that you are requesting to book the following rooms: ${selectedRooms.map(
          (room) => `${room.roomId} ${room.name}`
        )}  starting at ${formatDate(
          bookingTimeEvent.startStr
        )} and ending at ${formatDate(bookingTimeEvent.endStr)}`
      );
      if (isConfirmed) handleSetDate(bookingTimeEvent);
    }
  };

  useEffect(() => {
    const view = selectedRooms.length > 1 ? 'timeGridDay' : 'timeGridDay';
    allRooms.map((room) => {
      const calendarApi = room.calendarRef.current.getApi();
      calendarApi.changeView(view);
    });
  }),
    [selectedRooms];

  const handleChange = (selectedDate: Date) => {
    allRooms.forEach((room) => {
      room.calendarRef.current.getApi().gotoDate(selectedDate);
    });
  };

  return (
    <div className="mt-5 flex flex-col justify-center">
      <div className="flex justify-center items-center space-x-4 ">
        <div>
          <div className="">Select date</div>
          <CalendarDatePicker handleChange={handleChange} />
        </div>
        <div className="flex flex-col items-center ">
          <button
            key="calendarNextButton"
            disabled={!bookingTimeEvent}
            onClick={(e) => {
              validateEvents(e);
            }}
            className={`px-4 py-2 text-white rounded-md focus:outline-none ${
              bookingTimeEvent
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-300 pointer-events-none'
            }`}
          >
            Next
          </button>
        </div>
      </div>
      <div className="flex justify-center">
        {allRooms.map((room, i) => (
          <RoomCalendar
            room={room}
            selectedRooms={selectedRooms}
            allRooms={allRooms}
            bookingTimeEvent={bookingTimeEvent}
            setBookingTimeEvent={setBookingTimeEvent}
            canBookFullTime={canBookFullTime}
            isOverlap={isOverlap}
          />
        ))}
      </div>
    </div>
  );
};
