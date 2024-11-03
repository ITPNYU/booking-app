import React, { useContext, useMemo, useState } from "react";
import { TableNamesRaw, Tenants, getTableName } from "../../../../policy";

import AddRow from "../../components/AddRow";
import { Box } from "@mui/material";
import { DatabaseContext } from "../../components/Provider";
import { Department } from "../../../../types";
import Dropdown from "../../booking/components/Dropdown";
import ListTable from "../../components/ListTable";
import { formatDate } from "../../../utils/date";

const table = getTableName(TableNamesRaw.APPROVERS, Tenants.MEDIA_COMMONS);

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
      tableName={table}
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
    const sorted = filtered.sort((a, b) =>
      a.department.localeCompare(b.department)
    );
    return sorted as unknown as { [key: string]: string }[];
  }, [liaisonUsers]);

  return (
    <ListTable
      tableName={table}
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
