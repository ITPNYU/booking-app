import React, { useEffect, useState } from 'react';

import { Calendars } from './Calendars';
import { RoomSetting } from '../../../../types';
import { SelectRooms } from './SelectRooms';

export const MultipleCalendars = ({
  allRooms,
  handleSetDate,
  canBookFullTime,
}) => {
  const [calendarRefs, setCalendarRefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkedRoomIds, setCheckedRoomIds] = useState<string[]>([]);
  const [checkedRooms, setCheckedRooms] = useState<RoomSetting[]>([]);
  const [showMotionCaptureModal, setShowMotionCaptureModal] = useState(false);
  const [hasModalBeenShown, setHasModalBeenShown] = useState(false);

  const allRoomWithCalendarRefs = allRooms.map((room, i) => {
    room.calendarRef = React.createRef();
  });

  useEffect(() => {
    const refs = allRoomWithCalendarRefs;
    setCalendarRefs(refs);
    setLoading(false);
  }, [allRooms]);

  useEffect(() => {
    const checked = allRooms.filter((room) =>
      checkedRoomIds.includes(room.roomId)
    );
    setCheckedRooms(checked);
  }, [checkedRoomIds]);

  //if (loading) {
  //  return <div>Loading...</div>;
  //}

  const handleCheckboxChange = (event) => {
    const { value, checked } = event.target;

    const valuesArray = value.split(',');

    if (
      !hasModalBeenShown &&
      (valuesArray.includes('221') || valuesArray.includes('222'))
    ) {
      setShowMotionCaptureModal(true);
      setHasModalBeenShown(true);
    }

    if (checked) {
      setCheckedRoomIds((prev) => [...prev, ...valuesArray]);
    } else {
      setCheckedRoomIds((prev) =>
        prev.filter((item) => !valuesArray.includes(item))
      );
    }
  };

  const handleSubmit = (bookInfo) => {
    handleSetDate(bookInfo, checkedRooms);
  };

  const handleModalClick = () => {
    setShowMotionCaptureModal(false);
  };

  return (
    <div className="my-4 flex flex-col items-center">
      {showMotionCaptureModal && (
        <div
          id="popup-modal"
          tabIndex={-1}
          className="fixed left-[1000px] z-50 p-4 overflow-x-hidden overflow-y-auto md:inset-0 h-[calc(100%-1rem)] max-h-full"
        >
          <div className="relative w-full max-w-md max-h-full">
            <div className="relative bg-white rounded-lg shadow dark:bg-gray-700">
              <div className="p-6 text-center">
                <svg
                  className="mx-auto mb-4 text-gray-400 w-12 h-12 dark:text-gray-200"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 20 20"
                >
                  <path
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M10 11V6m0 8h.01M19 10a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
                <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
                  PLEASE NOTE: If you intend to use the motion capture rig in
                  Room 221 or 222, you'll also need to book Room 222
                  concurrently.
                </h3>
                <button
                  data-modal-hide="popup-modal"
                  type="button"
                  onClick={() => handleModalClick()}
                  className="text-white bg-blue-600 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800 font-medium rounded-lg text-sm inline-flex items-center px-5 py-2.5 text-center mr-2"
                >
                  Yes, I'm sure
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <SelectRooms
        allRooms={allRooms}
        handleCheckboxChange={handleCheckboxChange}
      />

      {calendarRefs.length > 0 && (
        <div className="mt-5 ml-20 flex justify-center">
          <Calendars
            allRooms={allRooms}
            selectedRooms={checkedRooms}
            handleSetDate={handleSubmit}
            canBookFullTime={canBookFullTime}
          />
        </div>
      )}
    </div>
  );
};
