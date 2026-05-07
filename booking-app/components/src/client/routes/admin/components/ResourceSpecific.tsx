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
import { Timestamp } from "firebase/firestore";
import { useCallback, useContext, useEffect, useState } from "react";

import {
  clientAddResourceRoomToApprover,
  clientDeleteDataFromFirestore,
  clientGetAllApproversWithRooms,
  clientRemoveAllResourcesApprover,
  clientRemoveResourceRoomFromApprover,
  clientSaveDataToFirestore,
  clientUpdateDataInFirestore,
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

type AllApproverEntry = {
  id: string;
  email: string;
  scope: "tenant" | "resource";
  resourceRoomIds: number[];
  createdAt?: Timestamp;
};

const normalizeApproverEmail = (email: string) => email.trim().toLowerCase();

const uniqueRoomIds = (ids: number[]): number[] => [...new Set(ids)];

const isAllRoomApprover = (approver: AllApproverEntry): boolean =>
  approver.scope === "resource";

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

  const [allApprovers, setAllApprovers] = useState<AllApproverEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setGlobalError(null);
    try {
      const data = await clientGetAllApproversWithRooms(tenant);
      setAllApprovers(data);
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

      const latest = await clientGetAllApproversWithRooms(tenant);
      const matches = latest.filter(
        (a) => normalizeApproverEmail(a.email) === normalizedEmail,
      );

      if (matches.length > 0) {
        const canonical =
          matches.find((a) => isAllRoomApprover(a)) ??
          matches.find((a) => (a.resourceRoomIds?.length ?? 0) > 0) ??
          matches[0];

        const mergedRoomIds = uniqueRoomIds([
          ...matches.flatMap((a) => a.resourceRoomIds ?? []),
          roomId,
        ]);

        await clientUpdateDataInFirestore(
          TableNames.APPROVERS,
          canonical.id,
          {
            email: normalizedEmail,
            resourceRoomIds: mergedRoomIds,
          },
          tenant,
        );

        const duplicates = matches.filter((a) => a.id !== canonical.id);
        await Promise.all(
          duplicates.map((d) =>
            clientDeleteDataFromFirestore(TableNames.APPROVERS, d.id, tenant),
          ),
        );

        await load();
      } else {
        // No existing approver doc — create one with this roomId
        await clientSaveDataToFirestore(
          TableNames.APPROVERS,
          {
            email: normalizedEmail,
            resourceRoomIds: [roomId],
            createdAt: Timestamp.now(),
          },
          tenant,
        );
        await load();
      }
    },
    [tenant, load],
  );

  const handleRemoveResourceApprover = useCallback(
    async (roomId: number, row: { [key: string]: string }) => {
      await clientRemoveResourceRoomFromApprover(row.id, roomId, tenant);
      const previous = allApprovers.find((a) => a.id === row.id);
      const nextRoomIds = (previous?.resourceRoomIds ?? []).filter(
        (id) => id !== roomId,
      );
      if (nextRoomIds.length === 0) {
        await clientDeleteDataFromFirestore(
          TableNames.APPROVERS,
          row.id,
          tenant,
        );
      }
      setAllApprovers((prev) =>
        prev.map((a) =>
          a.id === row.id
            ? {
                ...a,
                resourceRoomIds: a.resourceRoomIds.filter(
                  (id) => id !== roomId,
                ),
              }
            : a,
        ),
      );
    },
    [allApprovers, tenant],
  );

  const handleAddAllResourcesApprover = useCallback(
    async (email: string) => {
      const normalizedEmail = normalizeApproverEmail(email);
      if (!normalizedEmail) return;

      const latest = await clientGetAllApproversWithRooms(tenant);
      const matches = latest.filter(
        (a) => normalizeApproverEmail(a.email) === normalizedEmail,
      );
      const alreadyAllRoom = matches.some((a) => isAllRoomApprover(a));
      const existing =
        matches.find((a) => isAllRoomApprover(a)) ??
        matches.find((a) => (a.resourceRoomIds?.length ?? 0) > 0) ??
        matches[0];
      if (alreadyAllRoom) {
        // eslint-disable-next-line no-alert
        window.alert("This user is already an all-room approver");
        return;
      }

      if (existing) {
        await clientUpdateDataInFirestore(
          TableNames.APPROVERS,
          existing.id,
          {
            email: normalizedEmail,
            scope: "resource",
          },
          tenant,
        );

        const duplicates = matches.filter((a) => a.id !== existing.id);
        await Promise.all(
          duplicates.map((d) =>
            clientDeleteDataFromFirestore(TableNames.APPROVERS, d.id, tenant),
          ),
        );
      } else {
        await clientSaveDataToFirestore(
          TableNames.APPROVERS,
          {
            email: normalizedEmail,
            scope: "resource",
            resourceRoomIds: [],
            createdAt: Timestamp.now(),
          },
          tenant,
        );
      }
      await load();
    },
    [tenant, load],
  );

  const handleRemoveAllResourcesApprover = useCallback(
    async (row: { [key: string]: string }) => {
      await clientRemoveAllResourcesApprover(row.id, tenant);
      setAllApprovers((prev) => prev.filter((a) => a.id !== row.id));
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
        const resourceApprovers = allApprovers
          .filter((a) => a.resourceRoomIds.includes(resource.roomId))
          .map((a) => ({ id: a.id, email: a.email, createdAt: a.createdAt }));

        return (
          <ResourceSection
            key={resource.roomId}
            resource={resource}
            resourceApprovers={resourceApprovers}
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

/**
 * Standalone component rendering only the All-Room Approvers table.
 * Place this above the "Resource Specific" heading in Approvers.tsx.
 */
export const AllRoomApprovers = () => {
  const { tenant } = useContext(SchemaContext);
  const [allApprovers, setAllApprovers] = useState<AllApproverEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setGlobalError(null);
    try {
      const data = await clientGetAllApproversWithRooms(tenant);
      setAllApprovers(data);
    } catch {
      setGlobalError("Failed to load approvers.");
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = useCallback(
    async (email: string) => {
      const normalizedEmail = normalizeApproverEmail(email);
      if (!normalizedEmail) return;

      const latest = await clientGetAllApproversWithRooms(tenant);
      const matches = latest.filter(
        (a) => normalizeApproverEmail(a.email) === normalizedEmail,
      );
      const alreadyAllRoom = matches.some((a) => isAllRoomApprover(a));
      const existing =
        matches.find((a) => isAllRoomApprover(a)) ??
        matches.find((a) => (a.resourceRoomIds?.length ?? 0) > 0) ??
        matches[0];
      if (alreadyAllRoom) {
        // eslint-disable-next-line no-alert
        window.alert("This user is already an all-room approver");
        return;
      }

      if (existing) {
        await clientUpdateDataInFirestore(
          TableNames.APPROVERS,
          existing.id,
          {
            email: normalizedEmail,
            scope: "resource",
          },
          tenant,
        );

        const duplicates = matches.filter((a) => a.id !== existing.id);
        await Promise.all(
          duplicates.map((d) =>
            clientDeleteDataFromFirestore(TableNames.APPROVERS, d.id, tenant),
          ),
        );
      } else {
        await clientSaveDataToFirestore(
          TableNames.APPROVERS,
          {
            email: normalizedEmail,
            scope: "resource",
            resourceRoomIds: [],
            createdAt: Timestamp.now(),
          },
          tenant,
        );
      }
      await load();
    },
    [tenant, load],
  );

  const handleRemove = useCallback(
    async (row: { [key: string]: string }) => {
      await clientRemoveAllResourcesApprover(row.id, tenant);
      setAllApprovers((prev) => prev.filter((a) => a.id !== row.id));
    },
    [tenant],
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
      <ResourceApproverSection
        title="All-Room Approvers"
        rows={allApprovers
          .filter((a) => isAllRoomApprover(a))
          .map((a) => ({ id: a.id, email: a.email, createdAt: a.createdAt }))}
        onAdd={handleAdd}
        onRemove={handleRemove}
        refresh={load}
      />
    </Box>
  );
};
