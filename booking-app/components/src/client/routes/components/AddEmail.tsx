import AddRow from './AddRow';
import React from 'react';
import { TableNames } from '../../../policy';

interface EmailField {
  email: string;
}

interface Props<T extends EmailField> {
  tableName: TableNames;
  title: string;
  userList?: T[];
  userListRefresh: () => Promise<void>;
}

export default function AddEmail<T extends EmailField>({
  tableName,
  title,
  userList,
  userListRefresh,
}: Props<T>) {
  return (
    <AddRow
      addDuplicateErrorMessage="This user has already been added"
      addFailedErrorMessage="Failed to add user"
      columnNameUniqueValue="email"
      inputPlaceholder="Add email"
      rows={(userList || []) as unknown as { [key: string]: string }[]}
      rowsRefresh={userListRefresh}
      {...{ tableName, title }}
    />
  );
}
