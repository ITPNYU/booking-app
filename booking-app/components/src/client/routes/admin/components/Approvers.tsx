import { Stack, Typography } from "@mui/material";
import { useContext, useMemo } from "react";

import { SchemaContext } from "../../components/SchemaProvider";
import { EquipmentUsers } from "./EquipmentUsers";
import { Liaisons } from "./Liaisons";
import { ServiceApproverResourceTable } from "./ServiceApproverResourceTable";

export const Approvers = () => {
  const { resources, permissionLabels } = useContext(SchemaContext);

  const sortedResources = useMemo(
    () => [...resources].sort((a, b) => a.roomId - b.roomId),
    [resources],
  );

  return (
    <div>
      <Typography style={{ marginBottom: 24 }} variant="h6">
        {permissionLabels.reviewer}
      </Typography>
      <Liaisons />
      <Typography style={{ marginTop: 48, marginBottom: 24 }} variant="h6">
        Equipment Users
      </Typography>
      <EquipmentUsers />
      <Typography style={{ marginTop: 48, marginBottom: 24 }} variant="h6">
        {permissionLabels.services}
      </Typography>
      <Stack spacing={3}>
        {sortedResources.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No resources configured.
          </Typography>
        ) : (
          sortedResources.map((resource) => (
            <ServiceApproverResourceTable
              key={resource.roomId}
              resource={resource}
            />
          ))
        )}
      </Stack>
    </div>
  );
};
