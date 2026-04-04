"use client";

import {
  AddCircleOutline,
  DeleteOutline,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useContext, useMemo, useState } from "react";

import { getApiHeaders } from "@/components/src/client/utils/apiHeaders";
import type { Resource, ResourceService } from "../../components/SchemaProvider";
import { SchemaContext } from "../../components/SchemaProvider";
import { DatabaseContext } from "../../components/Provider";
import { isValidNetIdEmailFormat } from "../../../../utils/validationHelpers";

/**
 * Normalize a service entry that may still be in the old string[] format
 * (pre-migration Firestore data) into the new ResourceService shape.
 */
function normalizeService(s: ResourceService | string): ResourceService {
  if (typeof s === "string") return { type: s, approvers: [] };
  return { type: s.type ?? "", approvers: Array.isArray(s.approvers) ? s.approvers : [] };
}

interface ServiceApproverRow {
  email: string;
  serviceType?: string; // undefined for resource-level approvers
}

interface Props {
  resource: Resource;
}

export const ServiceApproverResourceTable = ({ resource }: Props) => {
  const { tenant } = useContext(SchemaContext);
  const { userEmail } = useContext(DatabaseContext);

  const hasServices = resource.services.length > 0;

  // Per-service state (only used when hasServices)
  const [services, setServices] = useState<ResourceService[]>(
    resource.services.map((s) => normalizeService(s as ResourceService | string)),
  );
  const [selectedServiceType, setSelectedServiceType] = useState<string>(
    resource.services[0]
      ? normalizeService(resource.services[0] as ResourceService | string).type
      : "",
  );

  // Resource-level approver state (only used when !hasServices)
  const [resourceApprovers, setResourceApprovers] = useState<string[]>(
    Array.isArray(resource.approvers) ? [...resource.approvers] : [],
  );

  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [validatingEmail, setValidatingEmail] = useState(false);
  const [loading, setLoading] = useState(false);

  // Flatten into display rows
  const rows = useMemo<ServiceApproverRow[]>(() => {
    if (hasServices) {
      const flat: ServiceApproverRow[] = [];
      for (const svc of services) {
        for (const email of svc.approvers) {
          flat.push({ email, serviceType: svc.type });
        }
      }
      return flat.sort(
        (a, b) =>
          (a.serviceType ?? "").localeCompare(b.serviceType ?? "") ||
          a.email.localeCompare(b.email),
      );
    }
    return resourceApprovers
      .map((email) => ({ email }))
      .sort((a, b) => a.email.localeCompare(b.email));
  }, [hasServices, services, resourceApprovers]);

  const validateAndLookupEmail = useCallback(async (value: string): Promise<boolean> => {
    const trimmed = value.trim();
    if (!trimmed) {
      setEmailError("Email is required");
      return false;
    }
    if (!isValidNetIdEmailFormat(trimmed)) {
      setEmailError("Must be a valid NetID email (e.g. abc123@nyu.edu)");
      return false;
    }
    const netId = trimmed.split("@")[0];
    setValidatingEmail(true);
    setEmailError(null);
    try {
      const res = await fetch(`/api/nyu/identity/${encodeURIComponent(netId)}`);
      if (!res.ok) {
        setEmailError("NetID not found in NYU Identity system");
        return false;
      }
      return true;
    } catch {
      setEmailError("Could not reach the NYU Identity API");
      return false;
    } finally {
      setValidatingEmail(false);
    }
  }, []);

  const handleAdd = useCallback(async () => {
    if (hasServices && !selectedServiceType) {
      setEmailError("Please select a service");
      return;
    }

    const trimmedEmail = emailInput.trim();
    const duplicate = hasServices
      ? rows.some(
          (r) =>
            r.email.toLowerCase() === trimmedEmail.toLowerCase() &&
            r.serviceType === selectedServiceType,
        )
      : rows.some((r) => r.email.toLowerCase() === trimmedEmail.toLowerCase());

    if (duplicate) {
      setEmailError(
        hasServices
          ? "This email is already an approver for this service"
          : "This email is already an approver for this resource",
      );
      return;
    }

    const valid = await validateAndLookupEmail(trimmedEmail);
    if (!valid) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/tenantSchema/${tenant}/serviceApprovers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getApiHeaders(tenant, { "x-user-email": userEmail ?? "" }),
        },
        body: JSON.stringify({
          resourceRoomId: resource.roomId,
          ...(hasServices && { serviceType: selectedServiceType }),
          email: trimmedEmail,
          action: "add",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setEmailError(data.error ?? "Failed to add approver");
        return;
      }

      if (hasServices) {
        setServices((prev) =>
          prev.map((s) =>
            s.type === selectedServiceType
              ? { ...s, approvers: [...s.approvers, trimmedEmail] }
              : s,
          ),
        );
      } else {
        setResourceApprovers((prev) => [...prev, trimmedEmail]);
      }

      setEmailInput("");
      setEmailError(null);
    } catch {
      setEmailError("Network error — could not add approver");
    } finally {
      setLoading(false);
    }
  }, [
    emailInput,
    hasServices,
    resource.roomId,
    rows,
    selectedServiceType,
    tenant,
    userEmail,
    validateAndLookupEmail,
  ]);

  const handleRemove = useCallback(
    async (row: ServiceApproverRow) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/tenantSchema/${tenant}/serviceApprovers`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getApiHeaders(tenant, { "x-user-email": userEmail ?? "" }),
          },
          body: JSON.stringify({
            resourceRoomId: resource.roomId,
            ...(row.serviceType && { serviceType: row.serviceType }),
            email: row.email,
            action: "remove",
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          alert(data.error ?? "Failed to remove approver");
          return;
        }

        if (hasServices && row.serviceType) {
          setServices((prev) =>
            prev.map((s) =>
              s.type === row.serviceType
                ? {
                    ...s,
                    approvers: s.approvers.filter(
                      (a) => a.toLowerCase() !== row.email.toLowerCase(),
                    ),
                  }
                : s,
            ),
          );
        } else {
          setResourceApprovers((prev) =>
            prev.filter((a) => a.toLowerCase() !== row.email.toLowerCase()),
          );
        }
      } catch {
        alert("Network error — could not remove approver");
      } finally {
        setLoading(false);
      }
    },
    [hasServices, resource.roomId, tenant, userEmail],
  );

  return (
    <Box>
      {/* Resource header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          py: 1,
          backgroundColor: "rgba(0,0,0,0.04)",
          borderRadius: 1,
          mb: 0,
        }}
      >
        <Typography variant="subtitle2" sx={{ color: "rgba(0,0,0,0.6)" }}>
          {resource.name}
          <Typography
            component="span"
            variant="caption"
            sx={{ ml: 1, color: "rgba(0,0,0,0.4)" }}
          >
            Room {resource.roomId}
          </Typography>
        </Typography>

        {/* Add approver controls */}
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
          {hasServices && (
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id={`service-select-label-${resource.roomId}`}>
                Service
              </InputLabel>
              <Select
                labelId={`service-select-label-${resource.roomId}`}
                value={selectedServiceType}
                label="Service"
                onChange={(e) => setSelectedServiceType(e.target.value)}
                disabled={loading}
              >
                {services.map((s) => (
                  <MenuItem key={s.type} value={s.type}>
                    {s.type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Box sx={{ display: "flex", flexDirection: "column" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <TextField
                size="small"
                placeholder="abc123@nyu.edu"
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value);
                  setEmailError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
                disabled={loading || validatingEmail}
                error={!!emailError}
                sx={{ width: 220 }}
                InputProps={{
                  endAdornment: validatingEmail ? (
                    <CircularProgress size={16} />
                  ) : undefined,
                }}
              />
              <IconButton
                onClick={handleAdd}
                color="primary"
                disabled={loading || validatingEmail || !emailInput.trim()}
                sx={{ padding: 0.5 }}
              >
                <AddCircleOutline />
              </IconButton>
            </Box>
            {emailError && (
              <Alert severity="error" sx={{ py: 0, mt: 0.5, fontSize: "0.75rem" }}>
                {emailError}
              </Alert>
            )}
          </Box>
        </Box>
      </Box>

      {/* Approver rows */}
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Email</TableCell>
            {hasServices && <TableCell>Service</TableCell>}
            <TableCell align="right">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={hasServices ? 3 : 2}
                sx={{ color: "rgba(0,0,0,0.4)", fontStyle: "italic" }}
              >
                No approvers configured
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, i) => (
              <TableRow key={`${row.serviceType ?? "resource"}-${row.email}-${i}`} hover>
                <TableCell>{row.email}</TableCell>
                {hasServices && <TableCell>{row.serviceType}</TableCell>}
                <TableCell align="right">
                  <IconButton
                    size="small"
                    color="error"
                    disabled={loading}
                    onClick={() => handleRemove(row)}
                  >
                    <DeleteOutline fontSize="small" />
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
