import React, { useMemo, useState } from 'react';

import Loading from '../../utils/Loading';
import { TableNames } from '../../../policy';
// This is a wrapper for google.script.run that lets us use promises.
import { serverFunctions } from '../../utils/serverFunctions';

interface EmailField {
  email: string;
}

interface Props<T extends EmailField> {
  columnFormatters?: { [key: string]: (value: string) => string };
  tableName: TableNames;
  userList: T[];
  userListRefresh: () => Promise<void>;
}

export default function EmailListTable<T extends EmailField>(props: Props<T>) {
  const refresh = props.userListRefresh;
  const columnFormatters = props.columnFormatters || {};

  const [loading, setLoading] = useState(false);

  const columnNames = useMemo<string[]>(() => {
    if (props.userList.length === 0) {
      return [];
    }
    return Object.keys(props.userList[0]) as Array<keyof T> as string[];
  }, [props.userList]);

  const onRemove = async (user: T) => {
    setLoading(true);
    try {
      await serverFunctions.removeFromListByEmail(props.tableName, user.email);
      await refresh();
    } catch (ex) {
      console.error(ex);
      alert('Failed to remove user');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loading />;
  }

  if (props.userList.length === 0) {
    return <p className="p-4">No results</p>;
  }

  return (
    <div className="m-10">
      <div className="w-[500px relative sm:rounded-lg">
        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              {/* all column headers */}
              {columnNames.map((columnName, idx) => (
                <th scope="col" className="px-2 py-3" key={idx}>
                  {formatColumnName(columnName)}
                </th>
              ))}
              <th scope="col" className="px-2 py-3">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {props.userList.map((user, index: number) => {
              return (
                <tr
                  key={index}
                  className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  {/* all column values */}
                  {columnNames.map((columnName, idx) => (
                    <td className="px-2 py-4 w-36" key={idx}>
                      {columnFormatters[columnName]
                        ? columnFormatters[columnName](user[columnName])
                        : user[columnName]}
                    </td>
                  ))}
                  <td className="px-2 py-4 w-36">
                    <button
                      className="font-medium text-blue-600 dark:text-blue-500 hover:underline"
                      onClick={() => onRemove(user)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatColumnName(columnName: string): string {
  // Split the column name at capital letters or underscores
  const parts = columnName.split(/(?=[A-Z])|_/);

  // Capitalize the first letter of each word and join with spaces
  const formattedName = parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return formattedName;
}
