import React, { useContext, useMemo, useState } from 'react';

import { DatabaseContext } from '../../components/Provider';
import EmailListTable from '../../components/EmailListTable';
import Loading from '../../../utils/Loading';
import { formatDate } from '../../../utils/date';
import { getLiaisonTableName } from '../../../../policy';
// This is a wrapper for google.script.run that lets us use promises.
import { serverFunctions } from '../../../utils/serverFunctions';
import { Department } from '../../../../types';

const AddLiaisonForm = ({ liaisonEmails, reloadLiaisonEmails }) => {
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(false);

  const addLiaisonUser = async () => {
    if (email === '' || department === '') {
      alert('Please fill in all the fields');
      return;
    }

    if (liaisonEmails.includes(email)) {
      alert('This user is already registered');
      return;
    }

    setLoading(true);
    try {
      await serverFunctions.appendRowActive(getLiaisonTableName(), [
        email,
        department,
        new Date().toString(),
      ]);
      await reloadLiaisonEmails();
    } catch (ex) {
      console.error(ex);
      alert('Failed to add user');
    } finally {
      setLoading(false);
      setEmail('');
    }
  };

  return (
    <div className="mt-10 mr-10 ml-10">
      <form className="flex items-center">
        <div className="mb-6 mr-6">
          <label
            htmlFor="email"
            className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
          >
            Email
          </label>
          <input
            type="email"
            id="email"
            onChange={(e) => {
              setEmail(e.target.value);
            }}
            value={email}
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            placeholder="name@nyu.edu"
            required
          />
        </div>
        <div className="mr-6">
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
        {loading ? (
          <Loading />
        ) : (
          <button
            type="button"
            onClick={addLiaisonUser}
            className="h-[40px] text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full sm:w-auto px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
          >
            Add User
          </button>
        )}
      </form>
    </div>
  );
};

export const Liaisons = () => {
  const { liaisonUsers, reloadLiaisonUsers } = useContext(DatabaseContext);

  const liaisonEmails = useMemo<string[]>(
    () => liaisonUsers.map((user) => user.email),
    [liaisonUsers]
  );

  return (
    <>
      <AddLiaisonForm
        liaisonEmails={liaisonEmails}
        reloadLiaisonEmails={reloadLiaisonUsers}
      />
      <EmailListTable
        tableName={getLiaisonTableName()}
        userList={liaisonUsers}
        userListRefresh={reloadLiaisonUsers}
        columnFormatters={{ createdAt: formatDate }}
      />
    </>
  );
};
