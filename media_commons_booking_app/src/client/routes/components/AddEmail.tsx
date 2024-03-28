import React, { useMemo, useState } from 'react';

import Loading from '../../utils/Loading';
import { TableNames } from '../../../policy';
import { serverFunctions } from '../../utils/serverFunctions';

interface EmailField {
  email: string;
}

interface Props<T extends EmailField> {
  tableName: TableNames;
  userList: T[];
  userListRefresh: () => Promise<void>;
}

export default function AddEmail<T extends EmailField>({
  tableName,
  userList,
  userListRefresh,
}: Props<T>) {
  const [emailToAdd, setEmailToAdd] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const userEmails = useMemo<string[]>(
    () => userList.map((user) => user.email),
    [userList]
  );

  const addUser = async () => {
    if (!emailToAdd) return;

    if (userEmails.includes(emailToAdd)) {
      alert('This user is already registered');
      return;
    }

    setLoading(true);
    try {
      await serverFunctions.appendRowActive(tableName, [
        emailToAdd,
        new Date().toString(),
      ]);
      await userListRefresh();
    } catch (ex) {
      console.error(ex);
      alert('Failed to add user');
    } finally {
      setLoading(false);
    }
  };

  // if (loading) {
  //   return <Loading />;
  // }

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
              setEmailToAdd(e.target.value);
            }}
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            placeholder="name@nyu.edu"
            required
          />
        </div>
        {loading ? (
          <Loading />
        ) : (
          <button
            type="button"
            onClick={addUser}
            className="h-[40px] text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full sm:w-auto px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
          >
            Add User
          </button>
        )}
      </form>
    </div>
  );
}
