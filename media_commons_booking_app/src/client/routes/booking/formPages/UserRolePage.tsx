import { Department, Role } from '../../../../types';
import React, { useContext } from 'react';

import { BookingContext } from '../bookingProvider';
import { useNavigate } from 'react-router-dom';

export default function UserRolePage() {
  const {
    isThesis_PLACEHOLDER,
    role,
    department,
    setDepartment,
    setIsThesis,
    setRole,
  } = useContext(BookingContext);

  const navigate = useNavigate();

  const handleNextClick = () => {
    if (!role || !department) {
      alert('Please make sure all fields are selected.');
      return;
    }
    navigate('/book/selectRoom');
  };

  return (
    <div
      id="staticModal"
      data-modal-backdrop="static"
      tabIndex={-1}
      aria-hidden="true"
      className="bg-white w-full h-120 p-4 overflow-x-hidden overflow-y-auto md:inset-0 h-[calc(100%-1rem)] max-h-full"
    >
      <div className="relative w-full max-w-2xl max-h-full">
        <div className="p-3 relative bg-white rounded-lg shadow dark:bg-gray-700">
          <div className="mb-3">
            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
              Select Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value as Department)}
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            >
              <option value="">Choose a Department</option>
              {Object.values(Department).map((label, index) => (
                <option key={index} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {/* <div className="flex items-start justify-between p-4 border-b rounded-t dark:border-gray-600"></div> */}

          <div className="mb-3">
            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
              Select Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            >
              <option value="">Choose a Role</option>
              {Object.values(Role).map((label, index) => (
                <option key={index} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {role === 'Student' && (
            <div className="flex items-center my-8">
              <input
                id="default-checkbox"
                type="checkbox"
                checked={isThesis_PLACEHOLDER}
                onChange={(e) => setIsThesis(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <label
                htmlFor="default-checkbox"
                className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300"
              >
                This request is related to my thesis or capstone
              </label>
            </div>
          )}
          <div className="block">
            <button
              onClick={handleNextClick}
              className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
