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
  columnNames: string[];
  index: number;
  refresh: () => Promise<void>;
  removeUser: () => Promise<void>;
  user: T;
}

export default function EmailListTableRow<T extends EmailField>(
  props: Props<T>
) {
  const { columnFormatters, columnNames, index, refresh, removeUser, user } =
    props;
  const [uiLoading, setUiLoading] = useState(false);
  const [isRemoved, setIsRemoved] = useState(false);

  const onError = () => {
    alert('Failed to remove user: ' + user.email);
  };

  /**
   * Google Sheets API writes are slow.
   * To avoid UI lag, assume write will succeed and optimistically remove UI element before response completes.
   * If write fails, alert the user and restore UI.
   * Only devs should see this error behavior unless something is very broken
   */
  const onRemove = async () => {
    setUiLoading(true);
    setIsRemoved(true); // optimistically hide component
    try {
      removeUser()
        .catch(() => {
          onError();
          setIsRemoved(false);
        })
        .finally(refresh);
    } catch (ex) {
      console.error(ex);
      onError();
    } finally {
      setUiLoading(false);
    }
  };

  if (uiLoading) {
    return <Loading />;
  }

  if (isRemoved) {
    return null;
  }

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
          onClick={onRemove}
        >
          Remove
        </button>
      </td>
    </tr>
  );
}
