import React, { useMemo } from 'react';

import ListTableRow from './ListTableRow';
import { TableNames } from '../../../policy';
import { serverFunctions } from '../../utils/serverFunctions';

interface Props {
  columnFormatters?: { [key: string]: (value: string) => string };
  columnNameToRemoveBy: string;
  tableName: TableNames;
  rows: { [key: string]: string }[];
  rowsRefresh: () => Promise<void>;
}

export default function ListTable(props: Props) {
  const refresh = props.rowsRefresh;
  const columnFormatters = props.columnFormatters || {};

  const columnNames = useMemo<string[]>(() => {
    if (props.rows.length === 0) {
      return [];
    }
    return Object.keys(props.rows[0]) as string[];
  }, [props.rows]);

  if (props.rows.length === 0) {
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
            {props.rows.map((row, index: number) => (
              <ListTableRow
                key={index}
                removeRow={() =>
                  serverFunctions.removeFromListByValue(
                    props.tableName,
                    row[props.columnNameToRemoveBy]
                  )
                }
                {...{ columnNames, columnFormatters, index, row, refresh }}
              />
            ))}
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
