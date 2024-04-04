import React, { useContext } from 'react';

import AddEmail from '../../components/AddEmail';
import { DatabaseContext } from '../../components/Provider';
import EmailListTable from '../../components/EmailListTable';
import { TableNames } from '../../../../policy';
import { formatDate } from '../../../utils/date';

export const PAUsers = () => {
  const { paUsers, reloadPaUsers } = useContext(DatabaseContext);

  return (
    <>
      <AddEmail
        tableName={TableNames.PAS}
        userList={paUsers}
        userListRefresh={reloadPaUsers}
      />
      <EmailListTable
        tableName={TableNames.PAS}
        userList={paUsers}
        userListRefresh={reloadPaUsers}
        columnFormatters={{ createdAt: formatDate }}
      />
    </>
  );
};
