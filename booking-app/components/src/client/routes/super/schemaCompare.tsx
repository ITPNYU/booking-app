"use client";

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Typography,
} from "@mui/material";
import { useCallback, useContext, useState } from "react";
import { DatabaseContext } from "../components/Provider";
import { computeDiff, formatValue, type DiffEntry } from "./schemaEditorUtils";

const ENVIRONMENTS = ["development", "staging", "production"] as const;
type Env = (typeof ENVIRONMENTS)[number];

type SnackState = {
  open: boolean;
  message: string;
  severity: "success" | "error" | "info";
};

export default function SchemaCompare() {
  const { userEmail } = useContext(DatabaseContext);
  const [tenant, setTenant] = useState<string>("");
  const [schemas, setSchemas] = useState<Record<string, any | null>>({});
  const [leftEnv, setLeftEnv] = useState<Env>("development");
  const [rightEnv, setRightEnv] = useState<Env>("production");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [dryRunning, setDryRunning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [snack, setSnack] = useState<SnackState>({
    open: false,
    message: "",
    severity: "success",
  });

  const fetchSchemas = useCallback(
    async (tenantId: string) => {
      if (!userEmail) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/tenantSchema/${tenantId}/compare`, {
          headers: { "x-user-email": userEmail },
        });
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
        const data = await res.json();
        setSchemas(data);
      } catch (err: any) {
        setSnack({ open: true, message: err.message, severity: "error" });
      } finally {
        setLoading(false);
      }
    },
    [userEmail],
  );

  const callSync = useCallback(
    async (dryRun: boolean) => {
      if (!userEmail || !tenant) return;
      if (dryRun) setDryRunning(true);
      else setSyncing(true);

      try {
        const res = await fetch(`/api/tenantSchema/${tenant}/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-email": userEmail,
          },
          body: JSON.stringify({
            sourceEnv: leftEnv,
            targetEnv: rightEnv,
            dryRun,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (dryRun) {
          const { added, changed, removed, unchanged } = data.diff;
          setSnack({
            open: true,
            severity: "info",
            message: `Dry run: ${added.length} added, ${changed.length} changed, ${removed.length} removed, ${unchanged.length} unchanged`,
          });
        } else {
          setSnack({
            open: true,
            severity: "success",
            message: `Synced "${tenant}" ${leftEnv} → ${rightEnv}. Backup: ${data.backupId ?? "N/A"}`,
          });
          fetchSchemas(tenant);
        }
      } catch (err: any) {
        setSnack({ open: true, message: err.message, severity: "error" });
      } finally {
        setDryRunning(false);
        setSyncing(false);
        setConfirmOpen(false);
      }
    },
    [userEmail, tenant, leftEnv, rightEnv, fetchSchemas],
  );

  const handleTenantChange = (tenantId: string) => {
    setTenant(tenantId);
    if (tenantId) fetchSchemas(tenantId);
  };

  const leftSchema = schemas[leftEnv];
  const rightSchema = schemas[rightEnv];
  const diffs: DiffEntry[] =
    leftSchema && rightSchema
      ? computeDiff(leftSchema, rightSchema)
      : [];

  const addedCount = diffs.filter((d) => d.type === "added").length;
  const removedCount = diffs.filter((d) => d.type === "removed").length;
  const changedCount = diffs.filter((d) => d.type === "changed").length;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Environment Schema Compare
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Compare tenantSchema across development, staging, and production.
      </Typography>

      <Box display="flex" gap={2} alignItems="center" mb={2} flexWrap="wrap">
        <FormControl sx={{ minWidth: 160 }}>
          <InputLabel>Tenant</InputLabel>
          <Select
            value={tenant}
            label="Tenant"
            onChange={(e) => handleTenantChange(e.target.value)}
          >
            {["mc", "itp"].map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 160 }}>
          <InputLabel>Left</InputLabel>
          <Select
            value={leftEnv}
            label="Left"
            onChange={(e) => setLeftEnv(e.target.value as Env)}
          >
            {ENVIRONMENTS.map((env) => (
              <MenuItem key={env} value={env}>
                {env}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Typography variant="body1">vs</Typography>

        <FormControl sx={{ minWidth: 160 }}>
          <InputLabel>Right</InputLabel>
          <Select
            value={rightEnv}
            label="Right"
            onChange={(e) => setRightEnv(e.target.value as Env)}
          >
            {ENVIRONMENTS.map((env) => (
              <MenuItem key={env} value={env}>
                {env}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {tenant && (
          <>
            <Button
              variant="outlined"
              onClick={() => fetchSchemas(tenant)}
              disabled={loading}
              size="small"
            >
              Refresh
            </Button>
            {leftEnv !== rightEnv && changedCount + addedCount + removedCount > 0 && (
              <>
                <Button
                  variant="outlined"
                  onClick={() => callSync(true)}
                  disabled={dryRunning || syncing}
                  size="small"
                  startIcon={dryRunning ? <CircularProgress size={16} /> : null}
                >
                  Dry Run
                </Button>
                <Button
                  variant="contained"
                  color="warning"
                  onClick={() => setConfirmOpen(true)}
                  disabled={dryRunning || syncing}
                  size="small"
                  startIcon={syncing ? <CircularProgress size={16} /> : null}
                >
                  Sync {leftEnv} → {rightEnv}
                </Button>
              </>
            )}
          </>
        )}
      </Box>

      {loading && (
        <Box display="flex" alignItems="center" gap={1} my={2}>
          <CircularProgress size={20} />
          <Typography variant="body2">
            Loading schemas from all environments...
          </Typography>
        </Box>
      )}

      {tenant && !loading && (
        <>
          {/* Environment availability */}
          <Box display="flex" gap={1} mb={2}>
            {ENVIRONMENTS.map((env) => (
              <Chip
                key={env}
                label={env}
                color={schemas[env] ? "success" : "error"}
                variant="outlined"
                size="small"
              />
            ))}
          </Box>

          {leftEnv === rightEnv ? (
            <Alert severity="info">
              Select two different environments to compare.
            </Alert>
          ) : !leftSchema || !rightSchema ? (
            <Alert severity="warning">
              {!leftSchema && `No schema found in ${leftEnv}. `}
              {!rightSchema && `No schema found in ${rightEnv}.`}
            </Alert>
          ) : diffs.length === 0 ? (
            <Alert severity="success">
              No differences between {leftEnv} and {rightEnv}.
            </Alert>
          ) : (
            <>
              <Box display="flex" gap={1} mb={2}>
                <Chip
                  label={`${addedCount} added`}
                  color="success"
                  size="small"
                />
                <Chip
                  label={`${removedCount} removed`}
                  color="error"
                  size="small"
                />
                <Chip
                  label={`${changedCount} changed`}
                  color="warning"
                  size="small"
                />
              </Box>

              <Box
                component="table"
                sx={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr>
                    <Box
                      component="th"
                      sx={{
                        textAlign: "left",
                        p: 1,
                        borderBottom: "2px solid #ddd",
                        width: "30%",
                      }}
                    >
                      Field
                    </Box>
                    <Box
                      component="th"
                      sx={{
                        textAlign: "left",
                        p: 1,
                        borderBottom: "2px solid #ddd",
                        width: "10%",
                      }}
                    >
                      Change
                    </Box>
                    <Box
                      component="th"
                      sx={{
                        textAlign: "left",
                        p: 1,
                        borderBottom: "2px solid #ddd",
                        width: "30%",
                      }}
                    >
                      {leftEnv}
                    </Box>
                    <Box
                      component="th"
                      sx={{
                        textAlign: "left",
                        p: 1,
                        borderBottom: "2px solid #ddd",
                        width: "30%",
                      }}
                    >
                      {rightEnv}
                    </Box>
                  </tr>
                </thead>
                <tbody>
                  {diffs.map((d, i) => (
                    <tr key={i}>
                      <Box
                        component="td"
                        sx={{
                          p: 1,
                          borderBottom: "1px solid #eee",
                          fontFamily: "monospace",
                          fontSize: 12,
                        }}
                      >
                        {d.path}
                      </Box>
                      <Box
                        component="td"
                        sx={{
                          p: 1,
                          borderBottom: "1px solid #eee",
                          color:
                            d.type === "added"
                              ? "success.main"
                              : d.type === "removed"
                                ? "error.main"
                                : "warning.main",
                          fontWeight: "bold",
                        }}
                      >
                        {d.type}
                      </Box>
                      <Box
                        component="td"
                        sx={{
                          p: 1,
                          borderBottom: "1px solid #eee",
                          fontFamily: "monospace",
                          fontSize: 12,
                          backgroundColor:
                            d.type === "removed" || d.type === "changed"
                              ? "#fff0f0"
                              : undefined,
                          wordBreak: "break-all",
                          maxWidth: 300,
                        }}
                      >
                        {d.type !== "added" ? formatValue(d.oldValue) : ""}
                      </Box>
                      <Box
                        component="td"
                        sx={{
                          p: 1,
                          borderBottom: "1px solid #eee",
                          fontFamily: "monospace",
                          fontSize: 12,
                          backgroundColor:
                            d.type === "added" || d.type === "changed"
                              ? "#f0fff0"
                              : undefined,
                          wordBreak: "break-all",
                          maxWidth: 300,
                        }}
                      >
                        {d.type !== "removed" ? formatValue(d.newValue) : ""}
                      </Box>
                    </tr>
                  ))}
                </tbody>
              </Box>
            </>
          )}
        </>
      )}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirm Schema Sync</DialogTitle>
        <DialogContent>
          <Typography>
            Overwrite <strong>{rightEnv}</strong> schema for tenant{" "}
            <strong>{tenant}</strong> with the <strong>{leftEnv}</strong>{" "}
            version?
          </Typography>
          <Typography sx={{ mt: 1 }} variant="body2" color="text.secondary">
            A backup will be saved to tenantSchemaBackup before overwriting.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => callSync(false)}
          >
            Sync
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={5000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
