import React, { useContext } from 'react';

import AddEmail from '../../components/AddEmail';
import { DatabaseContext } from '../../components/Provider';
import EmailListTable from '../../components/EmailListTable';
import { TableNames } from '../../../../policy';
import { formatDate } from '../../../utils/date';

export default function SafetyTrainedUsers() {
  const { safetyTrainedUsers, reloadSafetyTrainedUsers } =
    useContext(DatabaseContext);

  return (
    <>
      <AddEmail
        tableName={TableNames.SAFETY_TRAINING}
        userList={safetyTrainedUsers}
        userListRefresh={reloadSafetyTrainedUsers}
      />
      <EmailListTable
        columnFormatters={{ completedAt: formatDate }}
        tableName={TableNames.SAFETY_TRAINING}
        userList={safetyTrainedUsers}
        userListRefresh={reloadSafetyTrainedUsers}
      />
    </>
  );
}
