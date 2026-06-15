import { AddCircleOutline, Delete } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  clientAddResourceApprover,
  clientListResourceApprovers,
  clientRemoveResourceApprover,
} from "@/lib/firebase/firebase";
import { useTenantSchema } from "../../components/SchemaProvider";

type ResourceApprover = {
  id: string;
  resourceId: string;
  email: string;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

type ResourceApproverSectionProps = {
  name: string;
  resourceId: string;
  approvers: ResourceApprover[];
  onAdd: (resourceId: string, email: string) => Promise<void>;
  onRemove: (approver: ResourceApprover) => Promise<void>;
};

const ResourceApproverSection = ({
  name,
  resourceId,
  approvers,
  onAdd,
  onRemove,
}: ResourceApproverSectionProps) => {
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addApprover = async () => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return;
    }

    if (approvers.some((approver) => approver.email === normalizedEmail)) {
      setError("This user is already a resource approver.");
      return;
    }

    setAdding(true);
    setError(null);
    try {
      await onAdd(resourceId, normalizedEmail);
      setEmail("");
    } catch (addError) {
      console.error("Failed to add resource approver:", addError);
      setError("Failed to add resource approver.");
    } finally {
      setAdding(false);
    }
  };

  const removeApprover = async (approver: ResourceApprover) => {
    setRemovingId(approver.id);
    setError(null);
    try {
      await onRemove(approver);
    } catch (removeError) {
      console.error("Failed to remove resource approver:", removeError);
      setError("Failed to remove resource approver.");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={600} mb={1}>
        {name}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center" mb={1}>
        <TextField
          disabled={adding}
          inputProps={{ "aria-label": `Approver email for ${name}` }}
          onChange={(event) => setEmail(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void addApprover();
            }
          }}
          placeholder="Add email"
          size="small"
          value={email}
        />
        <IconButton
          aria-label={`Add approver for ${name}`}
          color="primary"
          disabled={adding || !email.trim()}
          onClick={() => void addApprover()}
        >
          {adding ? <CircularProgress size={20} /> : <AddCircleOutline />}
        </IconButton>
      </Stack>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1 }}>
          {error}
        </Alert>
      )}
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Email</TableCell>
            <TableCell align="right">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {approvers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={2}>No resource approvers.</TableCell>
            </TableRow>
          ) : (
            approvers.map((approver) => (
              <TableRow key={approver.id}>
                <TableCell>{approver.email}</TableCell>
                <TableCell align="right">
                  <IconButton
                    aria-label={`Remove ${approver.email} from ${name}`}
                    disabled={removingId === approver.id}
                    onClick={() => void removeApprover(approver)}
                  >
                    {removingId === approver.id ? (
                      <CircularProgress size={20} />
                    ) : (
                      <Delete />
                    )}
                  </IconButton>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Box>
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

  const addApprover = useCallback(
    async (resourceId: string, email: string) => {
      await clientAddResourceApprover(resourceId, email, tenantId);
      await loadApprovers();
    },
    [loadApprovers, tenantId],
  );

  const removeApprover = useCallback(
    async (approver: ResourceApprover) => {
      await clientRemoveResourceApprover(
        approver.resourceId,
        approver.email,
        tenantId,
      );
      setApprovers((current) =>
        current.filter((currentApprover) => currentApprover.id !== approver.id),
      );
    },
    [tenantId],
  );

  if (loading) {
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <CircularProgress size={20} />
        <Typography color="text.secondary">
          Loading resource approvers...
        </Typography>
      </Stack>
    );
  }

  if (loadError) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" onClick={() => void loadApprovers()}>
            Retry
          </Button>
        }
      >
        {loadError}
      </Alert>
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
    <Stack spacing={4}>
      {resources.map((resource) => (
        <ResourceApproverSection
          key={resource.resourceId}
          name={resource.name}
          resourceId={resource.resourceId}
          approvers={approversByResource.get(resource.resourceId) ?? []}
          onAdd={addApprover}
          onRemove={removeApprover}
        />
      ))}
    </Stack>
  );
};
