import { AddCircleOutline } from "@mui/icons-material";
import Grid from "@mui/material/Unstable_Grid2/Grid2";
import {
  IconButton,
  TextField,
  Typography,
  Box,
  Alert,
  CircularProgress,
} from "@mui/material";
import { useCallback, useContext, useEffect, useState } from "react";

import {
  clientAddResourceApprover,
  clientGetAllResourceApprovers,
  clientRemoveResourceApprover,
} from "@/lib/firebase/firebase";
import { formatDate } from "../../../utils/date";
import ListTable from "../../components/ListTable";
import { SchemaContext } from "../../components/SchemaProvider";
import type { Resource } from "../../components/SchemaProvider";
import { TableNames } from "../../../../policy";

type ApproverEntry = {
  id: string;
  email: string;
  createdAt?: any;
};

type ResourceApproverDoc = {
  id: string;
  email: string;
  resource: number;
  createdAt?: any;
};

const normalizeApproverEmail = (email: string) => email.trim().toLowerCase();

type ResourceApproverSectionProps = {
  title: string;
  rows: ApproverEntry[];
  onAdd: (email: string) => Promise<void>;
  onRemove: (row: { [key: string]: string }) => Promise<void>;
  refresh: () => Promise<void>;
};

const ResourceApproverSection = ({
  title,
  rows,
  onAdd,
  onRemove,
  refresh,
}: ResourceApproverSectionProps) => {
  const [valueToAdd, setValueToAdd] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    const email = valueToAdd.trim();
    if (!email) return;
    if (rows.some((r) => r.email.toLowerCase() === email.toLowerCase())) {
      // eslint-disable-next-line no-alert
      window.alert("This user has already been added");
      return;
    }
    setLoading(true);
    try {
      await onAdd(email);
      setValueToAdd("");
    } catch (err) {
      // eslint-disable-next-line no-alert
      window.alert(err instanceof Error ? err.message : "Failed to add user");
    } finally {
      setLoading(false);
    }
  };

  const topRow = (
    <Grid
      container
      spacing={2}
      display="flex"
      justifyContent="space-between"
      alignItems="center"
    >
      <Grid
        sx={{
          paddingLeft: "16px",
          color: "rgba(0,0,0,0.6)",
          fontSize: "0.8rem",
        }}
      >
        {title}
      </Grid>
      <Grid paddingLeft={0} paddingRight={4} display="flex" alignItems="center">
        <Grid container paddingRight={1}>
          <TextField
            onChange={(e) => setValueToAdd(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            value={valueToAdd}
            placeholder="Add email"
            size="small"
          />
        </Grid>
        <IconButton
          type="button"
          onClick={handleAdd}
          color="primary"
          sx={{ padding: 0 }}
          disabled={loading}
        >
          <AddCircleOutline />
        </IconButton>
      </Grid>
    </Grid>
  );

  return (
    <ListTable
      tableName={TableNames.APPROVERS}
      columnNameToRemoveBy="email"
      rows={rows as unknown as { [key: string]: string }[]}
      rowsRefresh={refresh}
      topRow={topRow}
      onRemoveRow={onRemove}
      columnFormatters={{ createdAt: formatDate }}
    />
  );
};

type ResourceSectionProps = {
  resource: Resource;
  resourceApprovers: ApproverEntry[];
  serviceApprovers: ApproverEntry[];
  onAddResourceApprover: (roomId: number, email: string) => Promise<void>;
  onRemoveResourceApprover: (
    roomId: number,
    row: { [key: string]: string },
  ) => Promise<void>;
  onAddServiceApprover: (roomId: number, email: string) => Promise<void>;
  onRemoveServiceApprover: (
    roomId: number,
    row: { [key: string]: string },
  ) => Promise<void>;
  refresh: () => Promise<void>;
};

const ResourceSection = ({
  resource,
  resourceApprovers,
  serviceApprovers,
  onAddResourceApprover,
  onRemoveResourceApprover,
  onAddServiceApprover,
  onRemoveServiceApprover,
  refresh,
}: ResourceSectionProps) => (
  <Box mb={4}>
    <Typography variant="h6" style={{ marginBottom: 16 }}>
      {resource.roomId} {resource.name}
    </Typography>
    <Box mb={3}>
      <ResourceApproverSection
        title="Resource Approvers"
        rows={resourceApprovers}
        onAdd={(email) => onAddResourceApprover(resource.roomId, email)}
        onRemove={(row) => onRemoveResourceApprover(resource.roomId, row)}
        refresh={refresh}
      />
    </Box>
    <ResourceApproverSection
      title="Service Approvers"
      rows={serviceApprovers}
      onAdd={(email) => onAddServiceApprover(resource.roomId, email)}
      onRemove={(row) => onRemoveServiceApprover(resource.roomId, row)}
      refresh={refresh}
    />
  </Box>
);

export const ResourceSpecific = () => {
  const { resources, tenant } = useContext(SchemaContext);

  const [resourceApprovers, setResourceApprovers] = useState<
    ResourceApproverDoc[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setGlobalError(null);
    try {
      const data = await clientGetAllResourceApprovers(tenant);
      setResourceApprovers(data);
    } catch {
      setGlobalError("Failed to load approvers.");
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddResourceApprover = useCallback(
    async (roomId: number, email: string) => {
      const normalizedEmail = normalizeApproverEmail(email);
      if (!normalizedEmail) return;

      await clientAddResourceApprover(roomId, normalizedEmail, tenant);
      await load();
    },
    [tenant, load],
  );

  const handleRemoveResourceApprover = useCallback(
    async (_roomId: number, row: { [key: string]: string }) => {
      await clientRemoveResourceApprover(row.id, tenant);
      setResourceApprovers((prev) => prev.filter((a) => a.id !== row.id));
    },
    [tenant],
  );

  const handleAddServiceApprover = useCallback(
    async (_roomId: number, _email: string) => {
      // TODO: wire to backend when resource-level service approvers are implemented
    },
    [],
  );

  const handleRemoveServiceApprover = useCallback(
    async (_roomId: number, _row: { [key: string]: string }) => {
      // TODO: wire to backend when resource-level service approvers are implemented
    },
    [],
  );

  if (loading) {
    return (
      <Box display="flex" alignItems="center" gap={1} mt={2}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">
          Loading...
        </Typography>
      </Box>
    );
  }

  return (
    <Box mt={1}>
      {globalError && (
        <Alert
          severity="error"
          onClose={() => setGlobalError(null)}
          sx={{ mb: 2 }}
        >
          {globalError}
        </Alert>
      )}
      {resources.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No resources in tenant schema.
        </Typography>
      )}
      {resources.map((resource) => {
        const rows = resourceApprovers
          .filter((a) => a.resource === resource.roomId)
          .map((a) => ({ id: a.id, email: a.email, createdAt: a.createdAt }));

        return (
          <ResourceSection
            key={resource.roomId}
            resource={resource}
            resourceApprovers={rows}
            serviceApprovers={[]}
            onAddResourceApprover={handleAddResourceApprover}
            onRemoveResourceApprover={handleRemoveResourceApprover}
            onAddServiceApprover={handleAddServiceApprover}
            onRemoveServiceApprover={handleRemoveServiceApprover}
            refresh={load}
          />
        );
      })}
    </Box>
  );
};

export const ResourceApprovers = ResourceSpecific;
