import ListTable from './ListTable';
import React from 'react';
import { TableNames } from '../../../policy';

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
  return (
    <ListTable
      columnNameToRemoveBy="email"
      rows={props.userList as unknown as { [key: string]: string }[]}
      rowsRefresh={props.userListRefresh}
      {...props}
    />
  );
}
