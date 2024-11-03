import React, { useContext } from "react";
import { TableNamesRaw, Tenants, getTableName } from "../../../../policy";

import EmailListTable from "../../components/EmailListTable";
import { SharedDatabaseContext } from "../../../providers/SharedDatabaseProvider";
import { formatDate } from "../../../utils/date";

export const AdminUsers = () => {
  const { adminUsers, reloadAdminUsers } = useContext(SharedDatabaseContext);

  return (
    <EmailListTable
      tableName={getTableName(TableNamesRaw.ADMINS, Tenants.MEDIA_COMMONS)}
      userList={adminUsers}
      userListRefresh={reloadAdminUsers}
      columnFormatters={{ createdAt: formatDate }}
      title="Admin Users"
    />
  );
};
