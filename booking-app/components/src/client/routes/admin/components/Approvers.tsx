import { Approver, Department } from "../../../../types";
import { Box, TextField, Typography } from "@mui/material";
import React, { useContext, useMemo, useState } from "react";

import AddRow from "../../components/AddRow";
import { DatabaseContext } from "../../components/Provider";
import Dropdown from "../../booking/components/Dropdown";
import ListTable from "../../components/ListTable";
import { TableNames } from "../../../../policy";
import { formatDate } from "../../../utils/date";

const AddApproverForm = ({ liaisonEmails, reloadLiaisonEmails, level }) => {
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
      title={`Approvers - Step ${level}`}
      extra={{
        components: [departmentDropdown],
        values: { department, level },
        updates: [setDepartment],
      }}
    />
  );
};

interface Props {
  level: number;
  approvers: Approver[];
}

const ApproverTable = ({ level, approvers }: Props) => {
  const { reloadApproverUsers } = useContext(DatabaseContext);

  const emails = useMemo<string[]>(
    () => approvers.map((user) => user.email),
    [approvers]
  );

  const rows = useMemo(() => {
    const filtered = approvers.map((approver) => {
      const { level, ...other } = approver;
      return other;
    });
    const sorted = filtered.sort((a, b) =>
      a.department.localeCompare(b.department)
    );
    return sorted as unknown as { [key: string]: string }[];
  }, [approvers]);

  return (
    <Box sx={{ marginBottom: 8 }} key={level}>
      <ListTable
        tableName={TableNames.APPROVERS}
        columnNameToRemoveBy="email"
        rows={rows}
        rowsRefresh={reloadApproverUsers}
        topRow={
          <AddApproverForm
            liaisonEmails={emails}
            reloadLiaisonEmails={reloadApproverUsers}
            level={level}
          />
        }
        columnFormatters={{ createdAt: formatDate }}
      />
    </Box>
  );
};

export const Approvers = () => {
  const { liaisonUsers } = useContext(DatabaseContext);

  // get distinct approval levels
  const levels = Array.from(
    new Set(liaisonUsers.map((approver) => approver.level))
  );

  const approversByLevel = levels.reduce(
    (acc, level) => {
      acc[level] = liaisonUsers.filter((approver) => approver.level === level);
      return acc;
    },
    {} as { [key: number]: typeof liaisonUsers }
  );

  return (
    <>
      {Object.entries(approversByLevel).map(([level, approvers]) => (
        <ApproverTable level={Number(level)} approvers={approvers} />
      ))}
    </>
  );
};
