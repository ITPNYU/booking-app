import { AddCircleOutline } from "@mui/icons-material";
import {
  Box,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Unstable_Grid2/Grid2";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  clientListApproversResources,
  clientUpdateApproversResource,
} from "@/lib/firebase/firebase";
import ListTable from "../../components/ListTable";
import { useTenantSchema } from "../../components/SchemaProvider";
import { TableNames } from "../../../../policy";
import {
  type ApproverService,
  type ApproversResource,
  getApproverResources,
  getResourceApproverServices,
} from "../../../../utils/approversResources";

const SERVICE_LABELS: Record<ApproverService, string> = {
  setup: "Setup",
  furnishings: "Furniture",
  equipment: "Equipment",
  staff: "Staffing",
  catering: "Catering",
  cleaning: "Cleanup",
  security: "Security",
};

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

type ApproverTableProps = {
  resourceId: string;
  approvers: ApproversResource | undefined;
  rowsRefresh: () => Promise<void>;
};

const ResourceApproverTable = ({
  resourceId,
  approvers,
  rowsRefresh,
}: ApproverTableProps) => {
  const { tenantId } = useTenantSchema();
  const [loading, setLoading] = useState(false);
  const [valueToAdd, setValueToAdd] = useState("");
  const emails = approvers?.resourceApprovers ?? [];

  const addResourceApprover = useCallback(async () => {
    const normalizedEmail = normalizeEmail(valueToAdd);
    if (!normalizedEmail) {
      return;
    }
    if (emails.includes(normalizedEmail)) {
      alert("This user is already a resource approver.");
      return;
    }

    setLoading(true);
    try {
      if (!(await validateNyuEmail(normalizedEmail, tenantId))) {
        alert("Enter a valid NYU NetID email.");
        return;
      }
      await clientUpdateApproversResource(
        resourceId,
        { action: "add", kind: "resource", email: normalizedEmail },
        tenantId,
      );
      setValueToAdd("");
      await rowsRefresh();
    } catch (error) {
      console.error("Failed to add resource approver:", error);
      alert("Failed to add resource approver.");
    } finally {
      setLoading(false);
    }
  }, [emails, resourceId, rowsRefresh, tenantId, valueToAdd]);

  const removeResourceApprover = useCallback(
    async (row: { [key: string]: string }) => {
      await clientUpdateApproversResource(
        resourceId,
        { action: "remove", kind: "resource", email: row.email },
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
      tableName={TableNames.APPROVERS_RESOURCES}
      columnNameToRemoveBy="email"
      rows={emails.map((email) => ({ id: email, email }))}
      rowsRefresh={rowsRefresh}
      topRow={topRow}
      onRemoveRow={removeResourceApprover}
    />
  );
};

const ServiceApproverTable = ({
  resourceId,
  approvers,
  rowsRefresh,
  services,
}: ApproverTableProps & { services: ApproverService[] }) => {
  const { tenantId } = useTenantSchema();
  const [loading, setLoading] = useState(false);
  const [serviceToAdd, setServiceToAdd] = useState<ApproverService | "">(
    services[0] ?? "",
  );
  const [valueToAdd, setValueToAdd] = useState("");

  useEffect(() => {
    if (!serviceToAdd || !services.includes(serviceToAdd)) {
      setServiceToAdd(services[0] ?? "");
    }
  }, [services, serviceToAdd]);

  // Only services the resource still offers: an assignment left behind by a
  // service removed from the schema is not used for routing either.
  const rows = useMemo(
    () =>
      services.flatMap((service) =>
        (approvers?.serviceApprovers[service] ?? []).map((email) => ({
          id: `${service}:${email}`,
          email,
          service,
        })),
      ),
    [approvers, services],
  );

  const addServiceApprover = useCallback(async () => {
    const normalizedEmail = normalizeEmail(valueToAdd);
    if (!normalizedEmail || !serviceToAdd) {
      return;
    }
    if (
      (approvers?.serviceApprovers[serviceToAdd] ?? []).includes(
        normalizedEmail,
      )
    ) {
      alert("This user has already been added");
      return;
    }

    setLoading(true);
    try {
      if (!(await validateNyuEmail(normalizedEmail, tenantId))) {
        alert("Enter a valid NYU NetID email.");
        return;
      }
      await clientUpdateApproversResource(
        resourceId,
        {
          action: "add",
          kind: "service",
          service: serviceToAdd,
          email: normalizedEmail,
        },
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
  }, [approvers, resourceId, rowsRefresh, serviceToAdd, tenantId, valueToAdd]);

  const removeServiceApprover = useCallback(
    async (row: { [key: string]: string }) => {
      await clientUpdateApproversResource(
        resourceId,
        {
          action: "remove",
          kind: "service",
          service: row.service as ApproverService,
          email: row.email,
        },
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
              onChange={(event) =>
                setServiceToAdd(event.target.value as ApproverService)
              }
              value={serviceToAdd}
              size="small"
              disabled={services.length === 0}
            >
              {services.map((service) => (
                <MenuItem key={service} value={service}>
                  {SERVICE_LABELS[service]}
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
              disabled={services.length === 0}
            />
          </Grid>
        </Grid>
        <IconButton
          onClick={() => void addServiceApprover()}
          color="primary"
          sx={{ padding: 0 }}
          disabled={loading || !valueToAdd.trim() || services.length === 0}
          aria-label={`Add service approver for ${resourceId}`}
        >
          <AddCircleOutline />
        </IconButton>
      </Grid>
    </Grid>
  );

  return (
    <ListTable
      tableName={TableNames.APPROVERS_RESOURCES}
      columnNameToRemoveBy="email"
      rows={rows}
      rowsRefresh={rowsRefresh}
      topRow={topRow}
      onRemoveRow={removeServiceApprover}
      columnFormatters={{
        service: (service) =>
          SERVICE_LABELS[service as ApproverService] ?? service,
      }}
    />
  );
};

export const ResourceSpecific = () => {
  const { resources, tenantId } = useTenantSchema();
  const [approversByResource, setApproversByResource] = useState<
    Map<string, ApproversResource>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadApprovers = useCallback(async () => {
    setLoadError(null);
    try {
      const docs = await clientListApproversResources(tenantId);
      setApproversByResource(new Map(docs.map((doc) => [doc.resourceId, doc])));
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

  // Annex spaces are approved through the room they are booked under.
  const approverResources = useMemo(
    () => getApproverResources(resources),
    [resources],
  );
  const servicesByResource = useMemo(
    () =>
      new Map(
        approverResources.map((resource) => [
          resource.resourceId,
          getResourceApproverServices(resource, resources),
        ]),
      ),
    [approverResources, resources],
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

  if (approverResources.length === 0) {
    return (
      <Typography color="text.secondary">
        No resources in tenant schema.
      </Typography>
    );
  }

  return (
    <Box mt={1}>
      <Typography color="text.secondary" mb={3}>
        A room with no approvers of its own uses the tenant final approver for
        final approval and the tenant-wide service approvers for its services.
      </Typography>
      {approverResources.map((resource) => (
        <Box key={resource.resourceId} mb={4}>
          <Typography variant="h6" style={{ marginBottom: 16 }}>
            {resource.resourceId} {resource.name}
          </Typography>
          <ResourceApproverTable
            resourceId={resource.resourceId}
            approvers={approversByResource.get(resource.resourceId)}
            rowsRefresh={loadApprovers}
          />
          <Box mt={3}>
            <ServiceApproverTable
              resourceId={resource.resourceId}
              approvers={approversByResource.get(resource.resourceId)}
              rowsRefresh={loadApprovers}
              services={servicesByResource.get(resource.resourceId) ?? []}
            />
          </Box>
        </Box>
      ))}
    </Box>
  );
};
