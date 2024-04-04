import React from 'react';

export const SelectRooms = ({ allRooms, handleCheckboxChange }) => {
  return (
    <div className="flex space-x-4">
      {allRooms.map((room, i) => {
        return (
          <div
            key={`${room.roomId}_${i}_checkbox`}
            className="flex items-center mb-4"
          >
            <input
              id={`checkbox${i}`}
              type="checkbox"
              onChange={handleCheckboxChange}
              value={room.roomId}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <label
              htmlFor={`checkbox${i}`}
              className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300"
            >
              {room.roomId} {room.name}
            </label>
          </div>
        );
      })}
    </div>
  );
};
