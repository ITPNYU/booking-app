import React, { useContext, useState } from 'react';

import { BookingContext } from '../bookingProvider';
import { DatabaseContext } from '../../components/Provider';
import { DateSelectArg } from '@fullcalendar/core';
import { MultipleCalendars } from '../components/MultipleCalendars';
import { RoomSetting } from '../../../../types';
import { SAFETY_TRAINING_REQUIRED_ROOM } from '../../../../policy';
import { useNavigate } from 'react-router-dom';

export default function SelectRoomPage() {
  const navigate = useNavigate();
  const { roomSettings, userEmail } = useContext(DatabaseContext);
  const {
    isBanned,
    isSafetyTrained,
    selectedRooms,
    setBookingCalendarInfo,
    setSelectedRooms,
  } = useContext(BookingContext);

  const handleSetDate = (info: DateSelectArg, rooms: RoomSetting[]) => {
    console.log('handle set date', info, rooms, selectedRooms);

    setBookingCalendarInfo(info);
    setSelectedRooms(rooms);
    const requiresSafetyTraining = rooms.some((room) =>
      SAFETY_TRAINING_REQUIRED_ROOM.includes(room.roomId)
    );
    if (userEmail && !isSafetyTrained && requiresSafetyTraining) {
      alert('You have to take safety training before booking!');
      return;
    }
    if (userEmail && isBanned) {
      alert('You are banned');
      return;
    }

    navigate('/book/form');
  };

  return (
    <div className="p-4 w-full">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
        {' '}
        Select room and view calendar
      </h3>
      <MultipleCalendars
        key="calendars"
        allRooms={roomSettings}
        handleSetDate={handleSetDate}
      />
    </div>
  );
}
