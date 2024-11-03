import EmailListTable from "../../components/EmailListTable";
import { TableNamesMediaCommonsOnly } from "@/components/src/policyMediaCommons";
import { formatDate } from "../../../utils/date";
import { useMediaCommonsDatabase } from "../../../providers/MediaCommonsDatabaseProvider";

export const PAUsers = () => {
  const { paUsers, reloadPaUsers } = useMediaCommonsDatabase();

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
