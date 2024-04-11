import React, { useContext, useMemo, useState } from 'react';

import { AdminUsers } from './AdminUsers';
import { BannedUsers } from './Ban';
import { Bookings } from './Bookings';
import { DatabaseContext } from '../../components/Provider';
import { Liaisons } from './Liaisons';
import Loading from '../../../utils/Loading';
import { PAUsers } from './PAUsers';
import { PagePermission } from '../../../../types';
import SafetyTrainedUsers from './SafetyTraining';

// This is a wrapper for google.script.run that lets us use promises.

export default function Admin() {
  const [tab, setTab] = useState('bookings');
  const { adminUsers, pagePermission, userEmail } = useContext(DatabaseContext);

  const adminEmails = useMemo<string[]>(
    () => adminUsers.map((user) => user.email),
    [adminUsers]
  );
  const userHasPermission = pagePermission === PagePermission.ADMIN;

  if (adminEmails.length === 0 || userEmail == null) {
    return <Loading />;
  }

  return (
    <div className="m-10">
      {!userHasPermission ? (
        <div className="m-10">
          You do not have permission to view this page.
        </div>
      ) : (
        <div>
          <ul className="flex flex-wrap text-sm font-medium text-center text-gray-500 border-b border-gray-200 dark:border-gray-700 dark:text-gray-400">
            <li className="mr-2">
              <a
                onClick={() => setTab('bookings')}
                aria-current="page"
                className={`${
                  tab === 'bookings'
                    ? 'inline-block p-4 text-blue-600 bg-gray-100 rounded-t-lg active dark:bg-gray-800 dark:text-blue-500'
                    : 'inline-block p-4 rounded-t-lg hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 dark:hover:text-gray-300 '
                }`}
              >
                Bookings
              </a>
            </li>
            <li className="mr-2">
              <a
                onClick={() => setTab('safety_training')}
                className={`${
                  tab === 'safety_training'
                    ? 'inline-block p-4 text-blue-600 bg-gray-100 rounded-t-lg active dark:bg-gray-800 dark:text-blue-500'
                    : 'inline-block p-4 rounded-t-lg hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 dark:hover:text-gray-300 '
                }`}
              >
                Safety Training
              </a>
            </li>
            <li className="mr-2">
              <a
                onClick={() => setTab('ban')}
                className={`${
                  tab === 'ban'
                    ? 'inline-block p-4 text-blue-600 bg-gray-100 rounded-t-lg active dark:bg-gray-800 dark:text-blue-500'
                    : 'inline-block p-4 rounded-t-lg hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 dark:hover:text-gray-300 '
                }`}
              >
                Ban
              </a>
            </li>
            <li className="mr-2">
              <a
                onClick={() => setTab('paUsers')}
                className={`${
                  tab === 'paUsers'
                    ? 'inline-block p-4 text-blue-600 bg-gray-100 rounded-t-lg active dark:bg-gray-800 dark:text-blue-500'
                    : 'inline-block p-4 rounded-t-lg hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 dark:hover:text-gray-300 '
                }`}
              >
                PA users
              </a>
            </li>
            <li className="mr-2">
              <a
                onClick={() => setTab('adminUsers')}
                className={`${
                  tab === 'adminUsers'
                    ? 'inline-block p-4 text-blue-600 bg-gray-100 rounded-t-lg active dark:bg-gray-800 dark:text-blue-500'
                    : 'inline-block p-4 rounded-t-lg hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 dark:hover:text-gray-300 '
                }`}
              >
                Admin users
              </a>
            </li>
            <li className="mr-2">
              <a
                onClick={() => setTab('liaesons')}
                className={`${
                  tab === 'liaesons'
                    ? 'inline-block p-4 text-blue-600 bg-gray-100 rounded-t-lg active dark:bg-gray-800 dark:text-blue-500'
                    : 'inline-block p-4 rounded-t-lg hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 dark:hover:text-gray-300 '
                }`}
              >
                Liaisons
              </a>
            </li>
          </ul>
          {tab === 'safety_training' && <SafetyTrainedUsers />}
          {tab === 'ban' && <BannedUsers />}
          {tab === 'adminUsers' && <AdminUsers />}
          {tab === 'paUsers' && <PAUsers />}
          {tab === 'liaesons' && <Liaisons />}
          {tab === 'bookings' && <Bookings isAdminView={true} />}
        </div>
      )}
    </div>
  );
}
