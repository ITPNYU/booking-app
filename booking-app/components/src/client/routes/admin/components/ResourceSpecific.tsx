import { AddCircleOutline } from "@mui/icons-material";
import { Box, IconButton, TextField, Typography } from "@mui/material";
import Grid from "@mui/material/Unstable_Grid2/Grid2";
import { Timestamp } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  clientAddResourceApprover,
  clientListResourceApprovers,
  clientRemoveResourceApprover,
} from "@/lib/firebase/firebase";
import { useTenantSchema } from "../../components/SchemaProvider";
import ListTable from "../../components/ListTable";
import { formatDate } from "../../../utils/date";
import { TableNames } from "../../../../policy";

type ResourceApprover = {
  id: string;
  resourceId: string;
  email: string;
  createdAt?: Timestamp;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

type ResourceApproverSectionProps = {
  resourceId: string;
  approvers: ResourceApprover[];
  rowsRefresh: () => Promise<void>;
};

const ResourceApproverSection = ({
  resourceId,
  approvers,
  rowsRefresh,
}: ResourceApproverSectionProps) => {
  const { tenantId } = useTenantSchema();
  const [valueToAdd, setValueToAdd] = useState("");

  const addApprover = async () => {
    const normalizedEmail = normalizeEmail(valueToAdd);
    if (!normalizedEmail) {
      return;
    }

    if (approvers.some((approver) => approver.email === normalizedEmail)) {
      alert("This user is already a resource approver.");
      return;
    }

    try {
      await clientAddResourceApprover(resourceId, normalizedEmail, tenantId);
      setValueToAdd("");
      await rowsRefresh();
    } catch (addError) {
      console.error("Failed to add resource approver:", addError);
      alert("Failed to add resource approver.");
    }
  };

  const rows = useMemo(
    () =>
      approvers.map(({ id, email, createdAt }) => ({
        id,
        email,
        createdAt,
      })),
    [approvers],
  );

  const removeApprover = useCallback(
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
        Resource Approvers
      </Grid>
      <Grid paddingLeft={0} paddingRight={4} display="flex" alignItems="center">
        <Grid container paddingRight={1}>
          <TextField
            id={`resource-approver-${resourceId}`}
            inputProps={{
              "aria-label": `Resource approver email for ${resourceId}`,
            }}
            onChange={(event) => setValueToAdd(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void addApprover();
              }
            }}
            value={valueToAdd}
            placeholder="Add email"
            size="small"
          />
        </Grid>
        <IconButton
          onClick={() => void addApprover()}
          color="primary"
          sx={{ padding: 0 }}
          disabled={!valueToAdd.trim()}
          aria-label={`Add resource approver for ${resourceId}`}
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
      onRemoveRow={removeApprover}
      columnFormatters={{ createdAt: formatDate }}
    />
  );
};

export const ResourceSpecific = () => {
  const { resources, tenantId } = useTenantSchema();
  const [approvers, setApprovers] = useState<ResourceApprover[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadApprovers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await clientListResourceApprovers(tenantId);
      setApprovers(
        data.map((approver) => ({
          ...approver,
          email: normalizeEmail(approver.email),
          resourceId: approver.resourceId.trim(),
        })),
      );
    } catch (error) {
      console.error("Failed to load resource approvers:", error);
      setLoadError("Failed to load resource approvers.");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadApprovers();
  }, [loadApprovers]);

  const approversByResource = useMemo(() => {
    const result = new Map<string, ResourceApprover[]>();
    approvers.forEach((approver) => {
      const resourceApprovers = result.get(approver.resourceId) ?? [];
      resourceApprovers.push(approver);
      result.set(approver.resourceId, resourceApprovers);
    });
    result.forEach((resourceApprovers) =>
      resourceApprovers.sort((a, b) => a.email.localeCompare(b.email)),
    );
    return result;
  }, [approvers]);

  if (loading) {
    return (
      <Typography color="text.secondary">
        Loading resource approvers...
      </Typography>
    );
  }

  if (loadError) {
    return (
      <Typography color="error">
        {loadError} Refresh the page to retry.
      </Typography>
    );
  }

  if (resources.length === 0) {
    return (
      <Typography color="text.secondary">
        No resources in tenant schema.
      </Typography>
    );
  }

  return (
    <Box mt={1}>
      {resources.map((resource) => (
        <Box key={resource.resourceId} mb={4}>
          <Typography variant="h6" style={{ marginBottom: 16 }}>
            {resource.resourceId} {resource.name}
          </Typography>
          <ResourceApproverSection
            resourceId={resource.resourceId}
            approvers={approversByResource.get(resource.resourceId) ?? []}
            rowsRefresh={loadApprovers}
          />
        </Box>
      ))}
    </Box>
  );
};
