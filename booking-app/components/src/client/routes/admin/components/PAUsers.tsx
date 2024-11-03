import React, { useContext } from "react";

import { DatabaseContext } from "../../components/Provider";
import EmailListTable from "../../components/EmailListTable";
import { TableNamesMediaCommonsOnly } from "@/components/src/mediaCommonsPolicy";
import { formatDate } from "../../../utils/date";

export const PAUsers = () => {
  const { paUsers, reloadPaUsers } = useContext(DatabaseContext);

  return (
    <EmailListTable
      tableName={TableNamesMediaCommonsOnly.PAS}
      userList={paUsers}
      userListRefresh={reloadPaUsers}
      columnFormatters={{ createdAt: formatDate }}
      title="PA Users"
    />
  );
};
