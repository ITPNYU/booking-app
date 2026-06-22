import { AddCircleOutline } from "@mui/icons-material";
import { IconButton, TextField, Typography } from "@mui/material";
import Grid from "@mui/material/Unstable_Grid2/Grid2";
import { Timestamp } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";

import ListTable from "../../components/ListTable";
import { useTenantSchema } from "../../components/SchemaProvider";
import { formatDate } from "../../../utils/date";
import { TableNames } from "../../../../policy";
import {
  clientAddResourceApprover,
  clientListResourceApprovers,
  clientRemoveResourceApprover,
} from "@/lib/firebase/firebase";

type ResourceApproverRow = {
  id: string;
  email: string;
  createdAt?: Timestamp;
};

type ResourceApproverTableProps = {
  resourceId: string;
  title: string;
  rows: ResourceApproverRow[];
  rowsRefresh: () => Promise<void>;
};

const ResourceApproverTable = ({
  resourceId,
  title,
  rows,
  rowsRefresh,
}: ResourceApproverTableProps) => {
  const { tenantId } = useTenantSchema();
  const [loading, setLoading] = useState(false);
  const [valueToAdd, setValueToAdd] = useState("");

  const addResourceApprover = useCallback(async () => {
    const trimmedEmail = valueToAdd.trim();
    if (!trimmedEmail) {
      return;
    }
    const normalizedEmail = trimmedEmail.toLowerCase();

    const duplicate = rows.some(
      (record) => record.email.toLowerCase() === normalizedEmail,
    );
    if (duplicate) {
      alert("This user has already been added");
      return;
    }

    setLoading(true);
    try {
      await clientAddResourceApprover(resourceId, normalizedEmail, tenantId);
      setValueToAdd("");
      await rowsRefresh();
    } catch (error) {
      console.error(error);
      alert("Failed to add resource approver");
    } finally {
      setLoading(false);
    }
  }, [resourceId, rows, rowsRefresh, tenantId, valueToAdd]);

  const removeResourceApprover = useCallback(
    async (row: { [key: string]: string }) => {
      await clientRemoveResourceApprover(resourceId, row.email, tenantId);
    },
    [resourceId, tenantId],
  );

  const topRow = (
    <Grid
      container
      spacing={2}
      display="flex"
      justifyContent={"space-between"}
      alignItems={"center"}
    >
      <Grid sx={{ paddingLeft: "16px", color: "rgba(0,0,0,0.6)" }}>
        {title}
      </Grid>
      <Grid paddingLeft={0} paddingRight={4} display="flex" alignItems="center">
        <Grid container paddingRight={1}>
          <TextField
            id={`resource-approver-${resourceId}`}
            inputProps={{ "aria-label": `Approver email for ${title}` }}
            onChange={(e) => setValueToAdd(e.target.value)}
            value={valueToAdd}
            placeholder="Add email"
            size="small"
          />
        </Grid>
        <IconButton
          onClick={addResourceApprover}
          color="primary"
          sx={{ padding: 0 }}
          disabled={loading}
          aria-label={`Add approver for ${title}`}
        >
          <AddCircleOutline />
        </IconButton>
      </Grid>
    </Grid>
  );

  return (
    <ListTable
      tableName={TableNames.RESOURCE_APPROVERS}
      columnNameToRemoveBy="email"
      rows={rows as unknown as { [key: string]: string }[]}
      rowsRefresh={rowsRefresh}
      topRow={topRow}
      onRemoveRow={removeResourceApprover}
      columnFormatters={{ createdAt: formatDate }}
    />
  );
};

export const ResourceSpecific = () => {
  const { resources, tenantId } = useTenantSchema();
  const [approvers, setApprovers] = useState<
    Array<ResourceApproverRow & { resourceId: string }>
  >([]);

  const loadApprovers = useCallback(async () => {
    const fetchedData = await clientListResourceApprovers(tenantId);
    setApprovers(
      fetchedData
        .map((item) => ({
          id: item.id,
          resourceId: item.resourceId,
          email: item.email,
          createdAt: item.createdAt,
        }))
        .sort((a, b) => a.email.localeCompare(b.email)),
    );
  }, [tenantId]);

  useEffect(() => {
    loadApprovers().catch((error) =>
      console.error("Error loading resource approvers:", error),
    );
  }, [loadApprovers]);

  const approversByResource = useMemo(() => {
    const result = new Map<string, ResourceApproverRow[]>();
    approvers.forEach(({ resourceId, ...row }) => {
      const rows = result.get(resourceId) ?? [];
      rows.push(row);
      result.set(resourceId, rows);
    });
    return result;
  }, [approvers]);

  if (resources.length === 0) {
    return (
      <Typography color="text.secondary">
        No resources in tenant schema.
      </Typography>
    );
  }

  return (
    <Grid container spacing={4}>
      {resources.map((resource) => (
        <Grid key={resource.resourceId} xs={12}>
          <ResourceApproverTable
            resourceId={resource.resourceId}
            title={`${resource.name} (${resource.resourceId})`}
            rows={approversByResource.get(resource.resourceId) ?? []}
            rowsRefresh={loadApprovers}
          />
        </Grid>
      ))}
    </Grid>
  );
};
