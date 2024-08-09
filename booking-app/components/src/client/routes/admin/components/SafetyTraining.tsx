import React, { useContext } from "react";

import { DatabaseContext } from "../../components/Provider";
import EmailListTable from "../../components/EmailListTable";
import { TableNames } from "../../../../policy";
import { formatDate } from "../../../utils/date";

export default function SafetyTrainedUsers() {
  const { safetyTrainedUsers, reloadSafetyTrainedUsers } =
    useContext(DatabaseContext);

  const safetyTrainUsersFromFirestore = safetyTrainedUsers.filter(
    (user) => user.id !== null
  );

  return (
    <EmailListTable
      columnFormatters={{ completedAt: formatDate }}
      tableName={TableNames.SAFETY_TRAINING}
      title="Safety Trained Users"
      userList={safetyTrainUsersFromFirestore}
      userListRefresh={reloadSafetyTrainedUsers}
    />
  );
}
