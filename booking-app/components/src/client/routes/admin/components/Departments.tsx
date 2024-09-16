import React, { useContext, useMemo, useState } from "react";

import AddDepartmentRow from "../../components/AddDepartmentRow";
import AddRow from "../../components/AddRow";
import { Box } from "@mui/material";
import { DatabaseContext } from "../../components/Provider";
import { Department } from "../../../../types";
import Dropdown from "../../booking/components/Dropdown";
import ListTable from "../../components/ListTable";
import { TableNames } from "../../../../policy";
import { formatDate } from "../../../utils/date";

const AddDepartmentForm = ({ departments, reloadDepartments }) => {
  const [departmentName, setDepartmentName] = useState("");
  const [departmentTier, setDepartmentTier] = useState("");

  const departmentDropdown = useMemo(
    () => (
      <Box width="200px" marginLeft={1}>
        <Dropdown
          value={departmentName}
          updateValue={setDepartmentName}
          options={Object.values(Department)}
          placeholder="Choose a Department"
        />
      </Box>
    ),
    [departmentName]
  );

  const departmentTierDropdown = useMemo(
    () => (
      <Box width="200px" marginLeft={1}>
        <Dropdown
          value={departmentTier}
          updateValue={setDepartmentTier}
          options={["Primary", "Secondary", "Tertiary"]}
          placeholder="Choose a Tier"
        />
      </Box>
    ),
    [departmentTier]
  );

  return (
    <AddDepartmentRow
      addDuplicateErrorMessage="This department is already registered"
      addFailedErrorMessage="Failed to add Department"
      columnNameUniqueValue="department"
      valueToAdd={departmentName}
      tableName={TableNames.DEPARTMENTS}
      rows={departments}
      rowsRefresh={reloadDepartments}
      title="Departments"
      components={[departmentDropdown, departmentTierDropdown]}
      values={{ departmentName, departmentTier }}
    />
  );
};

export const Departments = () => {
  const { departmentNames, reloadDepartmentNames } =
    useContext(DatabaseContext);

  const departments = useMemo<string[]>(
    () => departmentNames.map((user) => user.department),
    [departmentNames]
  );

  const formatDepartmentTier = (departmentTier) => {
    return departmentTier;
  };

  const formattedDepartmentNames = useMemo(() => {
    return departmentNames
      .map((user) => {
        return {
          ...user,
          departmentTier: user.departmentTier || "Unknown", // Display empty string if departmentTier is falsy
        };
      })
      .sort((a, b) => a.department.localeCompare(b.department));
  }, [departmentNames]);

  return (
    <ListTable
      tableName={TableNames.DEPARTMENTS}
      columnNameToRemoveBy="department"
      rows={formattedDepartmentNames as unknown as { [key: string]: string }[]}
      rowsRefresh={reloadDepartmentNames}
      topRow={
        <AddDepartmentForm
          departments={departments}
          reloadDepartments={reloadDepartmentNames}
        />
      }
      columnFormatters={{
        createdAt: formatDate,
        departmentTier: formatDepartmentTier,
      }} // Ensure columnFormatters includes departmentTier
    />
  );
};
