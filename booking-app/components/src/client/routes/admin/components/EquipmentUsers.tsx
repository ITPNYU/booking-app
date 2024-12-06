import { useContext, useMemo } from "react";

import { ApproverLevel, TableNames } from "../../../../policy";
import { formatDate } from "../../../utils/date";
import AddRow from "../../components/AddRow";
import ListTable from "../../components/ListTable";
import { DatabaseContext } from "../../components/Provider";

const AddEquipmentForm = ({ equipmentEmails, reloadEquipmentEmails }) => {
  return (
    <AddRow
      addDuplicateErrorMessage="This user is already registered"
      addFailedErrorMessage="Failed to add user as equipments"
      columnNameUniqueValue="email"
      inputPlaceholder="Add email"
      tableName={TableNames.APPROVERS}
      rows={equipmentEmails}
      rowsRefresh={reloadEquipmentEmails}
      title="Equipment Users"
      extra={{
        values: { level: ApproverLevel.EQUIPMENT },
      }}
    />
  );
};

export const EquipmentUsers = () => {
  const { equipmentUsers, reloadApproverUsers } = useContext(DatabaseContext);
  const equipmentEmails = useMemo<string[]>(
    () => equipmentUsers.map((user) => user.email),
    [equipmentUsers]
  );

  const rows = useMemo(() => {
    const filtered = equipmentUsers.map((liaison) => {
      const { level, ...other } = liaison;
      return other;
    });
    const sorted = filtered.sort((a, b) =>
      a.department.localeCompare(b.department)
    );
    return sorted as unknown as { [key: string]: string }[];
  }, [equipmentUsers]);

  return (
    <ListTable
      tableName={TableNames.APPROVERS}
      columnNameToRemoveBy="email"
      rows={rows}
      rowsRefresh={reloadApproverUsers}
      topRow={
        <AddEquipmentForm
          equipmentEmails={equipmentEmails}
          reloadEquipmentEmails={reloadApproverUsers}
        />
      }
      columnFormatters={{ createdAt: formatDate }}
    />
  );
};
