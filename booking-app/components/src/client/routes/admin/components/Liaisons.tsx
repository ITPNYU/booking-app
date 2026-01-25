import React, { useContext, useMemo, useState } from "react";

import AddRow from "../../components/AddRow";
import { Box } from "@mui/material";
import { DatabaseContext } from "../../components/Provider";
import { Department } from "../../../../types";
import Dropdown from "../../booking/components/Dropdown";
import ListTable from "../../components/ListTable";
import { TableNames } from "../../../../policy";
import { formatDate } from "../../../utils/date";

const AddLiaisonForm = ({ liaisonEmails, reloadLiaisonEmails }) => {
  const [department, setDepartment] = useState("");

  const departmentDropdown = useMemo(
    () => (
      <Box width="200px" marginLeft={1}>
        <Dropdown
          value={department}
          updateValue={setDepartment}
          options={Object.values(Department)}
          placeholder="Choose a Department"
        />
      </Box>
    ),
    [department]
  );

  return (
    <AddRow
      addDuplicateErrorMessage="This user+department is already registered"
      addFailedErrorMessage="Failed to add user as liaison"
      columnNameUniqueValue="email"
      inputPlaceholder="Add email"
      tableName={TableNames.APPROVERS}
      rows={liaisonEmails}
      rowsRefresh={reloadLiaisonEmails}
      title="Department Liaisons"
      extra={{
        components: [departmentDropdown],
        values: { department, level: 1 },
        updates: [setDepartment],
      }}
    />
  );
};

export const Liaisons = () => {
  const { liaisonUsers, reloadApproverUsers } = useContext(DatabaseContext);

  const liaisonEmails = useMemo<string[]>(
    () => liaisonUsers.map((user) => user.email),
    [liaisonUsers]
  );

  const rows = useMemo(() => {
    const filtered = liaisonUsers.map((liaison) => {
      const { level, ...other } = liaison;
      return other;
    });
    const sorted = filtered.sort((a, b) => {
      const deptA = a.department || "";
      const deptB = b.department || "";
      return deptA.localeCompare(deptB);
    });
    return sorted as unknown as { [key: string]: string }[];
  }, [liaisonUsers]);

  return (
    <ListTable
      tableName={TableNames.APPROVERS}
      columnNameToRemoveBy="email"
      rows={rows}
      rowsRefresh={reloadApproverUsers}
      topRow={
        <AddLiaisonForm
          liaisonEmails={liaisonEmails}
          reloadLiaisonEmails={reloadApproverUsers}
        />
      }
      columnFormatters={{ createdAt: formatDate }}
    />
  );
};
