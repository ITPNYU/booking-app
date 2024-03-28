import React from 'react';

export const SelectMotionCapture = ({ handleCheckboxChange }) => {
  return (
    <div className="flex space-x-4">
      <div key={`motioncapture_checkbox_1`} className="flex items-center mb-4">
        <input
          id={`motioncapture_checkbox_1`}
          type="checkbox"
          onChange={handleCheckboxChange}
          value={['221', '222']}
          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
        />
        <label
          htmlFor={`motioncapture_checkbox_1`}
          className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300"
        >
          Motion Capture 1 (Room: 221, 222)
        </label>
      </div>
      <div key={`motioncapture_checkbox_2`} className="flex items-center mb-4">
        <input
          id={`motioncapture_checkbox_2`}
          type="checkbox"
          onChange={handleCheckboxChange}
          value={['223']}
          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
        />
        <label
          htmlFor={`motioncapture_checkbox_2`}
          className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300"
        >
          Motion Capture 2 (Room: 223)
        </label>
      </div>
      <div key={`motioncapture_checkbox_3`} className="flex items-center mb-4">
        <input
          id={`motioncapture_checkbox_3`}
          type="checkbox"
          onChange={handleCheckboxChange}
          value={['224']}
          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
        />
        <label
          htmlFor={`motioncapture_checkbox_3`}
          className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300"
        >
          Motion Capture 3 (Room: 224)
        </label>
      </div>
    </div>
  );
};
