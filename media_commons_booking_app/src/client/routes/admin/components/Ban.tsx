// This is a wrapper for google.script.run that lets us use promises.
import React, { useContext } from 'react';

import AddEmail from '../../components/AddEmail';
import { DatabaseContext } from '../../components/Provider';
import EmailListTable from '../../components/EmailListTable';
import { TableNames } from '../../../../policy';
import { formatDate } from '../../../utils/date';

export const BannedUsers = () => {
  const { bannedUsers, reloadBannedUsers } = useContext(DatabaseContext);

  return (
    <>
      <AddEmail
        tableName={TableNames.BANNED}
        userList={bannedUsers}
        userListRefresh={reloadBannedUsers}
      />
      <EmailListTable
        tableName={TableNames.BANNED}
        userList={bannedUsers}
        userListRefresh={reloadBannedUsers}
        columnFormatters={{ bannedAt: formatDate }}
      />
    </>
  );
};
