import { AddCircleOutline } from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Unstable_Grid2/Grid2";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useTenantSchema } from "../../components/SchemaProvider";
import {
  ServiceApproverData,
  clientAddServiceApprover,
  clientListServiceApprovers,
  clientRemoveServiceApprover,
} from "@/lib/firebase/firebase";

const SERVICE_OPTIONS = [
  { key: "setup", label: "Setup" },
  { key: "equipment", label: "Equipment" },
  { key: "staff", label: "Staffing" },
  { key: "catering", label: "Catering" },
  { key: "cleaning", label: "Cleanup" },
  { key: "security", label: "Security" },
] as const;

type ServiceKey = (typeof SERVICE_OPTIONS)[number]["key"];

type InputState = Record<string, string>;

const inputKey = (resourceId: string, serviceType: ServiceKey) =>
  `${resourceId}::${serviceType}`;

export const ServiceSpecificApprovers = () => {
  const schema = useTenantSchema();
  const tenant = schema.tenantId;
  const [approvers, setApprovers] = useState<ServiceApproverData[]>([]);
  const [inputs, setInputs] = useState<InputState>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const resources = useMemo(
    () =>
      [...(schema.resources ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [schema.resources],
  );

  const loadApprovers = useCallback(async () => {
    setApprovers(await clientListServiceApprovers(tenant));
  }, [tenant]);

  useEffect(() => {
    loadApprovers().catch((error) =>
      console.error("Error loading service approvers:", error),
    );
  }, [loadApprovers]);

  const approversFor = (resourceId: string, serviceType: ServiceKey) =>
    approvers.filter(
      (approver) =>
        approver.resourceId === resourceId &&
        approver.serviceType === serviceType,
    );

  const addApprover = async (resourceId: string, serviceType: ServiceKey) => {
    const key = inputKey(resourceId, serviceType);
    const email = inputs[key]?.trim() ?? "";
    if (!email) return;

    setLoadingKey(key);
    try {
      await clientAddServiceApprover(resourceId, serviceType, email, tenant);
      setInputs((current) => ({ ...current, [key]: "" }));
      await loadApprovers();
    } catch (error) {
      console.error(error);
      alert("Failed to add service approver");
    } finally {
      setLoadingKey(null);
    }
  };

  const removeApprover = async (
    resourceId: string,
    serviceType: ServiceKey,
    email: string,
  ) => {
    const key = inputKey(resourceId, serviceType);
    setLoadingKey(key);
    try {
      await clientRemoveServiceApprover(resourceId, serviceType, email, tenant);
      await loadApprovers();
    } catch (error) {
      console.error(error);
      alert("Failed to remove service approver");
    } finally {
      setLoadingKey(null);
    }
  };

  if (resources.length === 0) {
    return (
      <Typography color="text.secondary">
        No resources are configured for this tenant.
      </Typography>
    );
  }

  return (
    <Stack spacing={3}>
      {resources.map((resource) => (
        <Card key={resource.resourceId} variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" marginBottom={2}>
              {resource.name} ({resource.resourceId})
            </Typography>
            <Stack spacing={2}>
              {SERVICE_OPTIONS.map((service) => {
                const key = inputKey(resource.resourceId, service.key);
                const currentApprovers = approversFor(
                  resource.resourceId,
                  service.key,
                );
                return (
                  <Box key={service.key}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid xs={12} md={2}>
                        <Typography color="text.secondary">
                          {service.label}
                        </Typography>
                      </Grid>
                      <Grid xs={12} md={5}>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Add email"
                          value={inputs[key] ?? ""}
                          onChange={(event) =>
                            setInputs((current) => ({
                              ...current,
                              [key]: event.target.value,
                            }))
                          }
                        />
                      </Grid>
                      <Grid xs={12} md={1}>
                        <IconButton
                          aria-label={`Add ${service.label} approver for ${resource.name}`}
                          color="primary"
                          disabled={loadingKey === key}
                          onClick={() =>
                            addApprover(resource.resourceId, service.key)
                          }
                        >
                          <AddCircleOutline />
                        </IconButton>
                      </Grid>
                      <Grid xs={12} md={4}>
                        <Stack direction="row" gap={1} flexWrap="wrap">
                          {currentApprovers.length === 0 ? (
                            <Typography color="text.secondary" variant="body2">
                              None configured
                            </Typography>
                          ) : (
                            currentApprovers.map((approver) => (
                              <Button
                                key={approver.id}
                                size="small"
                                variant="outlined"
                                disabled={loadingKey === key}
                                onClick={() =>
                                  removeApprover(
                                    resource.resourceId,
                                    service.key,
                                    approver.email,
                                  )
                                }
                              >
                                {approver.email} x
                              </Button>
                            ))
                          )}
                        </Stack>
                      </Grid>
                    </Grid>
                  </Box>
                );
              })}
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
};
