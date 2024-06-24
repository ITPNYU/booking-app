import React, { useContext } from 'react';

import { BookingContext } from '../bookingProvider';
import { DatabaseContext } from '../../components/Provider';
import { useLocation } from 'react-router-dom';

export const Header = () => {
  const { isBanned, isStudent, isSafetyTrained } = useContext(BookingContext);
  const { userEmail } = useContext(DatabaseContext);

  const location = useLocation();

  if (location.pathname === '/') {
    return null;
  }

  return (
    <div className="px-3 absolute top-20 right-0 text-right">
      <p className="dark:text-white">
        Email:{' '}
        {userEmail ? `${userEmail}` : `Unable to retrieve the email address.`}
      </p>
      <div>
        {!isSafetyTrained && isStudent && (
          <p className="text-red-500 text-bold  ">
            You have to take safety training before booking!
          </p>
        )}
        {isBanned && <p className="text-red-500 text-bold  ">You're banned </p>}
      </div>
    </div>
  );
};
