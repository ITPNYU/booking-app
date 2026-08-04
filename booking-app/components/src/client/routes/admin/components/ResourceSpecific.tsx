import { AddCircleOutline } from "@mui/icons-material";
import {
  Box,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Unstable_Grid2/Grid2";
import { Timestamp } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  clientAddResourceApprover,
  clientAddServiceApprover,
  clientListResourceApprovers,
  clientListServiceApprovers,
  clientRemoveResourceApprover,
  clientRemoveServiceApprover,
} from "@/lib/firebase/firebase";
import ListTable from "../../components/ListTable";
import { useTenantSchema } from "../../components/SchemaProvider";
import { formatDate } from "../../../utils/date";
import { TableNames } from "../../../../policy";

type ResourceApproverRow = {
  id: string;
  email: string;
  createdAt?: Timestamp;
};

type ResourceApprover = ResourceApproverRow & {
  resourceId: string;
};

type ServiceApproverRow = {
  id: string;
  service: string;
  email: string;
  createdAt?: Timestamp;
};

type ServiceApprover = ServiceApproverRow & {
  resourceId: string;
};

const SERVICE_LABELS: Record<string, string> = {
  setup: "Setup",
  equipment: "Equipment",
  staff: "Staffing",
  catering: "Catering",
  cleaning: "Cleanup",
  security: "Security",
};

const SERVICE_ALIASES: Record<string, string> = {
  staffing: "staff",
  cleanup: "cleaning",
};

const normalizeServiceKey = (service: string): string =>
  SERVICE_ALIASES[service.trim().toLowerCase()] ?? service.trim().toLowerCase();

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const validateNyuEmail = async (
  email: string,
  tenantId: string,
): Promise<boolean> => {
  const match = email.match(/^([a-z0-9._-]+)@nyu\.edu$/i);
  if (!match) return false;
  const response = await fetch(
    `/api/nyu/identity/${encodeURIComponent(match[1])}`,
    { headers: { "x-tenant": tenantId } },
  );
  return response.ok;
};

type ResourceApproverTableProps = {
  resourceId: string;
  rows: ResourceApproverRow[];
  rowsRefresh: () => Promise<void>;
};

const ResourceApproverTable = ({
  resourceId,
  rows,
  rowsRefresh,
}: ResourceApproverTableProps) => {
  const { tenantId } = useTenantSchema();
  const [loading, setLoading] = useState(false);
  const [valueToAdd, setValueToAdd] = useState("");

  const addResourceApprover = useCallback(async () => {
    const normalizedEmail = normalizeEmail(valueToAdd);
    if (!normalizedEmail) {
      return;
    }

    const duplicate = rows.some(
      (record) => normalizeEmail(record.email) === normalizedEmail,
    );
    if (duplicate) {
      alert("This user is already a resource approver.");
      return;
    }

    setLoading(true);
    try {
      await clientAddResourceApprover(resourceId, normalizedEmail, tenantId);
      setValueToAdd("");
      await rowsRefresh();
    } catch (error) {
      console.error("Failed to add resource approver:", error);
      alert("Failed to add resource approver.");
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
                void addResourceApprover();
              }
            }}
            value={valueToAdd}
            placeholder="Add email"
            size="small"
          />
        </Grid>
        <IconButton
          onClick={() => void addResourceApprover()}
          color="primary"
          sx={{ padding: 0 }}
          disabled={loading || !valueToAdd.trim()}
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
      onRemoveRow={removeResourceApprover}
      columnFormatters={{ createdAt: formatDate }}
    />
  );
};

type ServiceApproverTableProps = {
  resourceId: string;
  serviceOptions: Array<{ key: string; label: string }>;
  rows: ServiceApproverRow[];
  rowsRefresh: () => Promise<void>;
};

const ServiceApproverTable = ({
  resourceId,
  serviceOptions,
  rows,
  rowsRefresh,
}: ServiceApproverTableProps) => {
  const { tenantId } = useTenantSchema();
  const [loading, setLoading] = useState(false);
  const [serviceToAdd, setServiceToAdd] = useState<string>(
    serviceOptions[0]?.key ?? "",
  );
  const [valueToAdd, setValueToAdd] = useState("");

  useEffect(() => {
    if (!serviceOptions.some((service) => service.key === serviceToAdd)) {
      setServiceToAdd(serviceOptions[0]?.key ?? "");
    }
  }, [serviceOptions, serviceToAdd]);

  const addServiceApprover = useCallback(async () => {
    const normalizedEmail = normalizeEmail(valueToAdd);
    if (!normalizedEmail || !serviceToAdd) {
      return;
    }

    const duplicate = rows.some(
      (record) =>
        record.service === serviceToAdd &&
        normalizeEmail(record.email) === normalizedEmail,
    );
    if (duplicate) {
      alert("This user has already been added");
      return;
    }

    setLoading(true);
    try {
      const isValidEmail = await validateNyuEmail(normalizedEmail, tenantId);
      if (!isValidEmail) {
        alert("Enter a valid NYU NetID email.");
        return;
      }
      await clientAddServiceApprover(
        resourceId,
        serviceToAdd,
        normalizedEmail,
        tenantId,
      );
      setValueToAdd("");
      await rowsRefresh();
    } catch (error) {
      console.error("Failed to add service approver:", error);
      alert("Failed to add service approver.");
    } finally {
      setLoading(false);
    }
  }, [resourceId, rows, rowsRefresh, serviceToAdd, tenantId, valueToAdd]);

  const removeServiceApprover = useCallback(
    async (row: { [key: string]: string }) => {
      await clientRemoveServiceApprover(
        resourceId,
        row.service,
        row.email,
        tenantId,
      );
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
        Service Approvers
      </Grid>
      <Grid paddingLeft={0} paddingRight={4} display="flex" alignItems="center">
        <Grid container paddingRight={1} spacing={1}>
          <Grid>
            <TextField
              select
              id={`service-approver-service-${resourceId}`}
              inputProps={{ "aria-label": `Service for ${resourceId}` }}
              onChange={(event) => setServiceToAdd(event.target.value)}
              value={serviceToAdd}
              size="small"
              disabled={serviceOptions.length === 0}
            >
              {serviceOptions.map((service) => (
                <MenuItem key={service.key} value={service.key}>
                  {service.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid>
            <TextField
              id={`service-approver-email-${resourceId}`}
              inputProps={{
                "aria-label": `Service approver email for ${resourceId}`,
              }}
              onChange={(event) => setValueToAdd(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void addServiceApprover();
                }
              }}
              value={valueToAdd}
              placeholder="Add email"
              size="small"
              disabled={serviceOptions.length === 0}
            />
          </Grid>
        </Grid>
        <IconButton
          onClick={() => void addServiceApprover()}
          color="primary"
          sx={{ padding: 0 }}
          disabled={
            loading || !valueToAdd.trim() || serviceOptions.length === 0
          }
          aria-label={`Add service approver for ${resourceId}`}
        >
          <AddCircleOutline />
        </IconButton>
      </Grid>
    </Grid>
  );

  return (
    <ListTable
      tableName={TableNames.SERVICE_APPROVERS}
      columnNameToRemoveBy="email"
      rows={rows as unknown as { [key: string]: string }[]}
      rowsRefresh={rowsRefresh}
      topRow={topRow}
      onRemoveRow={removeServiceApprover}
      columnFormatters={{ createdAt: formatDate }}
    />
  );
};

export const ResourceSpecific = () => {
  const { resources, tenantId } = useTenantSchema();
  const [approvers, setApprovers] = useState<ResourceApprover[]>([]);
  const [serviceApprovers, setServiceApprovers] = useState<ServiceApprover[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadApprovers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [fetchedResourceApprovers, fetchedServiceApprovers] =
        await Promise.all([
          clientListResourceApprovers(tenantId),
          clientListServiceApprovers(tenantId),
        ]);
      setApprovers(
        fetchedResourceApprovers.map((item) => ({
          id: item.id,
          resourceId: item.resourceId.trim(),
          email: normalizeEmail(item.email),
          createdAt: item.createdAt,
        })),
      );
      setServiceApprovers(
        fetchedServiceApprovers.map((item) => ({
          id: item.id,
          resourceId: item.resourceId.trim(),
          service: normalizeServiceKey(item.service),
          email: normalizeEmail(item.email),
          createdAt: item.createdAt,
        })),
      );
    } catch (error) {
      console.error("Failed to load approvers:", error);
      setLoadError("Failed to load approvers.");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadApprovers();
  }, [loadApprovers]);

  const approversByResource = useMemo(() => {
    const result = new Map<string, ResourceApproverRow[]>();
    approvers.forEach(({ resourceId, ...row }) => {
      const rows = result.get(resourceId) ?? [];
      rows.push(row);
      result.set(resourceId, rows);
    });
    result.forEach((rows) =>
      rows.sort((a, b) => a.email.localeCompare(b.email)),
    );
    return result;
  }, [approvers]);

  const serviceOptionsByResource = useMemo(() => {
    const result = new Map<string, Array<{ key: string; label: string }>>();
    resources.forEach((resource) => {
      const seen = new Set<string>();
      const options = (resource.services ?? []).reduce<
        Array<{ key: string; label: string }>
      >((acc, service) => {
        const key = normalizeServiceKey(service);
        if (!SERVICE_LABELS[key] || seen.has(key)) return acc;
        seen.add(key);
        acc.push({ key, label: SERVICE_LABELS[key] });
        return acc;
      }, []);
      result.set(resource.resourceId, options);
    });
    return result;
  }, [resources]);

  const serviceApproversByResource = useMemo(() => {
    const result = new Map<string, ServiceApproverRow[]>();
    serviceApprovers.forEach(({ resourceId, ...row }) => {
      const allowedServices = new Set(
        (serviceOptionsByResource.get(resourceId) ?? []).map(
          (service) => service.key,
        ),
      );
      if (!allowedServices.has(row.service)) return;
      const rows = result.get(resourceId) ?? [];
      rows.push(row);
      result.set(resourceId, rows);
    });
    result.forEach((rows) =>
      rows.sort((a, b) => {
        const serviceCompare = a.service.localeCompare(b.service);
        if (serviceCompare !== 0) return serviceCompare;
        return a.email.localeCompare(b.email);
      }),
    );
    return result;
  }, [serviceApprovers, serviceOptionsByResource]);

  const sortedResources = useMemo(
    () =>
      [...resources].sort((a, b) =>
        String(a.resourceId).localeCompare(String(b.resourceId), undefined, {
          numeric: true,
        }),
      ),
    [resources],
  );

  if (loading) {
    return <Typography color="text.secondary">Loading approvers...</Typography>;
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
      {sortedResources.map((resource) => (
        <Box key={resource.resourceId} mb={4}>
          <Typography variant="h6" style={{ marginBottom: 16 }}>
            {resource.resourceId} {resource.name}
          </Typography>
          <ResourceApproverTable
            resourceId={resource.resourceId}
            rows={approversByResource.get(resource.resourceId) ?? []}
            rowsRefresh={loadApprovers}
          />
          <Box mt={3}>
            <ServiceApproverTable
              resourceId={resource.resourceId}
              serviceOptions={
                serviceOptionsByResource.get(resource.resourceId) ?? []
              }
              rows={serviceApproversByResource.get(resource.resourceId) ?? []}
              rowsRefresh={loadApprovers}
            />
          </Box>
        </Box>
      ))}
    </Box>
  );
};
