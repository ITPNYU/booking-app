import AddRow from './AddRow';
import React from 'react';
import { TableNames } from '../../../policy';

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
  return (
    <AddRow
      addDuplicateErrorMessage="This user has already been added"
      addFailedErrorMessage="Failed to add user"
      buttonText="Add User"
      columnNameToAddValue="email"
      inputPlaceholder="name@nyu.edu"
      label="Email"
      rows={userList as unknown as { [key: string]: string }[]}
      rowsRefresh={userListRefresh}
      {...{ tableName }}
    />
  );
}
