import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/book/role');
  };

  return (
    <div
      id="staticModal"
      data-modal-backdrop="static"
      tabIndex={-1}
      aria-hidden="true"
      className="z-50 w-full p-4 overflow-x-hidden overflow-y-auto md:inset-0 h-[calc(100%-1rem)] max-h-full"
    >
      <div className="relative w-full max-w-2xl max-h-full">
        <div className="relative bg-white rounded-lg shadow dark:bg-gray-700">
          <div className="flex items-start justify-between p-4 border-b rounded-t dark:border-gray-600">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              370🅙 Media Commons Reservation Form
            </h3>
          </div>
          <p className="p-6 space-y-6">
            Thank you for your interest in booking with the Media Commons.
            <br />
            Please read our Policy for using the 370 Jay Street Shared Spaces
            <br />
            <br />
            <b>Booking Confirmation:</b> You will receive an email response from
            the 370J Operations team and a calendar invite once your request has
            been reviewed and processed. Please allow a minimum of 3 days for
            your request to be approved. If you do not hear back about your
            request within 48 hours, you can contact the Media Commons Team (
            <a
              href="mailto:mediacommons.reservations@nyu.edu"
              className="font-medium text-blue-600 underline dark:text-blue-500 dark:hover:text-blue-600 hover:text-blue-700 hover:no-underline"
            >
              mediacommons.reservations@nyu.edu
            </a>
            ) to follow up. A request does not guarantee a booking.
            <br />
            <br />
            <b>Cancellation Policy:</b> To cancel reservations please email the
            Media Commons Team(
            <a
              href="mailto:mediacommons.reservations@nyu.edu"
              className="font-medium text-blue-600 underline dark:text-blue-500 dark:hover:text-blue-600 hover:text-blue-700 hover:no-underline"
            >
              mediacommons.reservations@nyu.edu
            </a>
            ) at least 24 hours before the date of the event. Failure to cancel
            may result in restricted use of event spaces.
            <br />
            <a
              href="https://docs.google.com/document/d/1vAajz6XRV0EUXaMrLivP_yDq_LyY43BvxOqlH-oNacc/edit"
              className="font-medium text-blue-600 underline dark:text-blue-500 dark:hover:text-blue-600 hover:text-blue-700 hover:no-underline"
              target="_blank"
            >
              Media Commons Policy
            </a>
            <a
              href="https://docs.google.com/document/d/1TIOl8f8-7o2BdjHxHYIYELSb4oc8QZMj1aSfaENWjR8/edit#heading=h.ns3jisyhutvq"
              className="font-medium text-blue-600 underline dark:text-blue-500 dark:hover:text-blue-600 hover:text-blue-700 hover:no-underline"
              target="_blank"
            >
              Pre-Event Checklist
            </a>
          </p>
          <div className="flex items-center p-6 space-x-2 border-t border-gray-200 rounded-b dark:border-gray-600">
            <button
              data-modal-hide="staticModal"
              type="button"
              onClick={handleClick}
              className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
            >
              I accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
