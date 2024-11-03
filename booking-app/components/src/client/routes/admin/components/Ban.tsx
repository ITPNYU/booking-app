// This is a wrapper for google.script.run that lets us use promises.
import React, { useContext } from "react";
import { TableNamesRaw, Tenants, getTableName } from "../../../../policy";

import EmailListTable from "../../components/EmailListTable";
import { SharedDatabaseContext } from "../../../providers/SharedDatabaseProvider";
import { formatDate } from "../../../utils/date";

export const BannedUsers = () => {
  const { bannedUsers, reloadBannedUsers } = useContext(SharedDatabaseContext);

  return (
    <EmailListTable
      tableName={getTableName(TableNamesRaw.BANNED, Tenants.MEDIA_COMMONS)}
      userList={bannedUsers}
      userListRefresh={reloadBannedUsers}
      columnFormatters={{ bannedAt: formatDate }}
      title="Banned Users"
    />
  );
};
