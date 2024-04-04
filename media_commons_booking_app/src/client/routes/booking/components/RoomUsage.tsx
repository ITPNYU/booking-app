import React, { useState } from 'react';

export const RoomUsage = ({ selectedPurpose, handleSetSelectedPurpose }) => {
  return (
    <div>
      <label
        htmlFor="roomUsage"
        className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
      >
        Select Room
      </label>
      <select
        id="usage"
        onChange={(e) => {
          e.stopPropagation();
          handleSetSelectedPurpose(e.target.value);
        }}
        className="mr-4 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500  p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
      >
        <option value="" selected>
          Select Room
        </option>
        <option key="room" value="multipleRoom">
          Booking room
        </option>
        <option key="motion" value="motionCapture">
          Booking motion capture
        </option>
      </select>
    </div>
  );
};
