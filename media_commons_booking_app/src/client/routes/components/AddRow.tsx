import React, { useMemo, useState } from 'react';

import Loading from '../../utils/Loading';
import { TableNames } from '../../../policy';
import { serverFunctions } from '../../utils/serverFunctions';

interface Props {
  addDuplicateErrorMessage?: string;
  addFailedErrorMessage?: string;
  buttonText?: string;
  columnNameToAddValue: string;
  inputPlaceholder?: string;
  label: string;
  tableName: TableNames;
  rows: { [key: string]: string }[];
  rowsRefresh: () => Promise<void>;
}

export default function AddRow(props: Props) {
  const { tableName, rows, rowsRefresh } = props;
  const [valueToAdd, setValueToAdd] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const uniqueValues = useMemo<string[]>(
    () => rows.map((row) => row[props.columnNameToAddValue]),
    [rows]
  );

  const addValue = async () => {
    if (!valueToAdd || valueToAdd.length === 0) return;

    if (uniqueValues.includes(valueToAdd)) {
      alert(
        props.addDuplicateErrorMessage ?? 'This value has already been added'
      );
      return;
    }

    setLoading(true);
    try {
      await serverFunctions.appendRowActive(tableName, [
        valueToAdd,
        new Date().toString(),
      ]);
      await rowsRefresh();
    } catch (ex) {
      console.error(ex);
      alert(props.addFailedErrorMessage ?? 'Failed to add value');
    } finally {
      setLoading(false);
      setValueToAdd('');
    }
  };

  return (
    <div className="mt-10 mr-10 ml-10">
      <form className="flex items-center">
        <div className="mb-6 mr-6">
          <label
            htmlFor="valueToAdd"
            className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
          >
            {props.label}
          </label>
          <input
            id="valueToAdd"
            onChange={(e) => {
              setValueToAdd(e.target.value);
            }}
            value={valueToAdd}
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            placeholder={props.inputPlaceholder ?? ''}
            required
          />
        </div>
        {loading ? (
          <Loading />
        ) : (
          <button
            type="button"
            onClick={addValue}
            className="h-[40px] text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full sm:w-auto px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
          >
            {props.buttonText ?? 'Add'}
          </button>
        )}
      </form>
    </div>
  );
}
