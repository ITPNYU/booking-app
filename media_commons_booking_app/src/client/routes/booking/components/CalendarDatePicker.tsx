import React, { useState } from 'react';
import Datepicker from 'tailwind-datepicker-react';

export const CalendarDatePicker = ({ handleChange }) => {
  const options = {
    title: 'Date',
    autoHide: true,
    todayBtn: true,
    clearBtn: false,
    maxDate: new Date('2030-01-01'),
    minDate: new Date('1950-01-01'),
    theme: {
      background: '',
      todayBtn: '',
      clearBtn: '',
      icons: '',
      text: 'text-sm',
      disabledText: '',
      input: '',
      inputIcon: '',
      selected: '',
    },
    datepickerClassNames: 'top-12',
    defaultDate: new Date(),
    language: 'en',
  };

  const [show, setShow] = useState(false);

  const handleClose = (state: boolean) => {
    setShow(state);
  };

  return (
    <div>
      <Datepicker
        options={options}
        onChange={handleChange}
        show={show}
        setShow={handleClose}
      />
    </div>
  );
};
