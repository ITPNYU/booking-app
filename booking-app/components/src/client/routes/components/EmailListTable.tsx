import React, { useMemo } from "react";

import AddEmail from "./AddEmail";
import ListTable from "./ListTable";
import { TableNames } from "../../../policy";

interface EmailField {
  email: string;
}

interface Props<T extends EmailField> {
  columnFormatters?: { [key: string]: (value: string) => string };
  tableName: TableNames;
  title: string;
  userList: T[];
  userListRefresh: () => Promise<void>;
}

export default function EmailListTable<T extends EmailField>(props: Props<T>) {
  const addEmail = useMemo(() => <AddEmail {...props} />, [props]);
  props.userList.sort((a, b) => a.email.localeCompare(b.email));

  return (
    <ListTable
      columnNameToRemoveBy="email"
      rows={props.userList as unknown as { [key: string]: string }[]}
      rowsRefresh={props.userListRefresh}
      topRow={addEmail}
      {...props}
    />
  );
}
