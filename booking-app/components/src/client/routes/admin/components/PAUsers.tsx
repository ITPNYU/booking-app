import React, { useContext } from "react";

import { DatabaseContext } from "../../components/Provider";
import EmailListTable from "../../components/EmailListTable";
import { TableNames } from "../../../../policy";
import { formatDate } from "../../../utils/date";

export const PAUsers = () => {
  const { paUsers, reloadPaUsers } = useContext(DatabaseContext);

  return (
    <EmailListTable
      tableName={TableNames.PAS}
      userList={paUsers}
      userListRefresh={reloadPaUsers}
      columnFormatters={{ createdAt: formatDate }}
      title="PA Users"
    />
  );
};
