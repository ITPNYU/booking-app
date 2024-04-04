import React, { useContext } from 'react';

import AddEmail from '../../components/AddEmail';
import { DatabaseContext } from '../../components/Provider';
import EmailListTable from '../../components/EmailListTable';
import { TableNames } from '../../../../policy';
import { formatDate } from '../../../utils/date';

export const AdminUsers = () => {
  const { adminUsers, reloadAdminUsers } = useContext(DatabaseContext);

  return (
    <>
      <AddEmail
        tableName={TableNames.ADMINS}
        userList={adminUsers}
        userListRefresh={reloadAdminUsers}
      />
      <EmailListTable
        tableName={TableNames.ADMINS}
        userList={adminUsers}
        userListRefresh={reloadAdminUsers}
        columnFormatters={{ createdAt: formatDate }}
      />
    </>
  );
};
