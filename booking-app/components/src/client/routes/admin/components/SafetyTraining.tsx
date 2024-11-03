import React, { useContext } from "react";
import { TableNamesRaw, Tenants, getTableName } from "../../../../policy";

import EmailListTable from "../../components/EmailListTable";
import { SharedDatabaseContext } from "../../../providers/SharedDatabaseProvider";
import { formatDate } from "../../../utils/date";

export default function SafetyTrainedUsers() {
  const { safetyTrainedUsers, reloadSafetyTrainedUsers } = useContext(
    SharedDatabaseContext
  );

  const safetyTrainUsersFromFirestore = safetyTrainedUsers.filter(
    (user) => user.id !== null
  );

  return (
    <EmailListTable
      columnFormatters={{ completedAt: formatDate }}
      tableName={getTableName(
        TableNamesRaw.SAFETY_TRAINING,
        Tenants.MEDIA_COMMONS
      )}
      title="Safety Trained Users"
      userList={safetyTrainUsersFromFirestore}
      userListRefresh={reloadSafetyTrainedUsers}
    />
  );
}
