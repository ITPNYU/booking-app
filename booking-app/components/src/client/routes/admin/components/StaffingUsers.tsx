import { useContext } from "react";

import { TableNames } from "../../../../policy";
import { formatDate } from "../../../utils/date";
import EmailListTable from "../../components/EmailListTable";
import { DatabaseContext } from "../../components/Provider";

export const StaffingUsers = () => {
  const { staffingUsers, reloadStaffingUsers } = useContext(DatabaseContext);

  return (
    <EmailListTable
      tableName={TableNames.USERS_RIGHTS}
      userList={staffingUsers}
      userListRefresh={reloadStaffingUsers}
      columnFormatters={{ createdAt: formatDate }}
      title="Staffing Users"
      extra={{
        values: { isStaffing: true },
      }}
    />
  );
};
