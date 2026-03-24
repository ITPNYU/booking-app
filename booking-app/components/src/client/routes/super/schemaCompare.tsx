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

/** Full JSON string — never truncated. */
function formatValueFull(val: unknown): string {
  if (val === undefined) return "(undefined)";
  if (val === null) return "(null)";
  if (typeof val === "object") return JSON.stringify(val, null, 2);
  return String(val);
}

/** Value cell that respects row-level expanded state. */
function DryRunValue({
  value,
  bg,
  expanded,
}: {
  value: unknown;
  bg?: string;
  expanded: boolean;
}) {
  const full = formatValueFull(value);
  const isLong = full.length > 120;

  return (
    <Box
      component="td"
      sx={{
        p: 1,
        borderBottom: "1px solid #ddd",
        fontFamily: "monospace",
        fontSize: 11,
        backgroundColor: bg,
        wordBreak: "break-all",
        whiteSpace: "pre-wrap",
      }}
    >
      {isLong && !expanded ? full.slice(0, 120) + " ..." : full}
    </Box>
  );
}

/** Row with expand/collapse toggle that applies to both source and target. */
function DryRunRow({
  keyName,
  changeType,
  sourceValue,
  targetValue,
  sourceBg,
  targetBg,
}: {
  keyName: string;
  changeType: string;
  sourceValue?: unknown;
  targetValue?: unknown;
  sourceBg?: string;
  targetBg?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const sourceStr = formatValueFull(sourceValue);
  const targetStr = formatValueFull(targetValue);
  const isLong = sourceStr.length > 120 || targetStr.length > 120;

  const color =
    changeType === "changed"
      ? "warning.main"
      : changeType === "added"
        ? "success.main"
        : "error.main";

  return (
    <tr>
      <Box component="td" sx={{ p: 1, borderBottom: "1px solid #ddd", fontFamily: "monospace", fontSize: 12 }}>
        {keyName}
        {isLong && (
          <Box
            component="span"
            onClick={() => setExpanded(!expanded)}
            sx={{
              ml: 1,
              color: "primary.main",
              cursor: "pointer",
              fontSize: 11,
              textDecoration: "underline",
            }}
          >
            {expanded ? "collapse" : "expand"}
          </Box>
        )}
      </Box>
      <Box component="td" sx={{ p: 1, borderBottom: "1px solid #ddd", color, fontWeight: "bold" }}>
        {changeType}
      </Box>
      {sourceValue !== undefined ? (
        <DryRunValue value={sourceValue} bg={sourceBg} expanded={expanded} />
      ) : (
        <Box component="td" sx={{ p: 1, borderBottom: "1px solid #ddd" }} />
      )}
      {targetValue !== undefined ? (
        <DryRunValue value={targetValue} bg={targetBg} expanded={expanded} />
      ) : (
        <Box component="td" sx={{ p: 1, borderBottom: "1px solid #ddd" }} />
      )}
    </tr>
  );
}

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
  const [dryRunResult, setDryRunResult] = useState<{
    added: { key: string; sourceValue?: unknown }[];
    removed: { key: string; targetValue?: unknown }[];
    changed: { key: string; sourceValue?: unknown; targetValue?: unknown }[];
    unchangedCount: number;
  } | null>(null);
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
          setDryRunResult(data.diff);
        } else {
          setDryRunResult(null);
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
    setDryRunResult(null);
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
            onChange={(e) => { setLeftEnv(e.target.value as Env); setDryRunResult(null); }}
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
            onChange={(e) => { setRightEnv(e.target.value as Env); setDryRunResult(null); }}
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
                  Dry Run ({leftEnv} → {rightEnv})
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

      {dryRunResult && (
        <Box
          sx={{
            mb: 2,
            p: 2,
            border: "1px solid",
            borderColor: "info.main",
            borderRadius: 1,
            backgroundColor: "#f0f7ff",
          }}
        >
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Dry Run Result — {leftEnv} → {rightEnv}
          </Typography>
          {dryRunResult.changed.length === 0 &&
            dryRunResult.added.length === 0 &&
            dryRunResult.removed.length === 0 && (
              <Typography variant="body2">No changes would be applied.</Typography>
            )}
          {(dryRunResult.changed.length > 0 ||
            dryRunResult.added.length > 0 ||
            dryRunResult.removed.length > 0) && (
            <Box
              component="table"
              sx={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
                mt: 1,
              }}
            >
              <thead>
                <tr>
                  <Box component="th" sx={{ textAlign: "left", p: 1, borderBottom: "2px solid #ccc", width: "20%" }}>
                    Key
                  </Box>
                  <Box component="th" sx={{ textAlign: "left", p: 1, borderBottom: "2px solid #ccc", width: "10%" }}>
                    Change
                  </Box>
                  <Box component="th" sx={{ textAlign: "left", p: 1, borderBottom: "2px solid #ccc", width: "35%" }}>
                    {leftEnv} (source)
                  </Box>
                  <Box component="th" sx={{ textAlign: "left", p: 1, borderBottom: "2px solid #ccc", width: "35%" }}>
                    {rightEnv} (target)
                  </Box>
                </tr>
              </thead>
              <tbody>
                {dryRunResult.changed.map((d) => (
                  <DryRunRow
                    key={d.key}
                    keyName={d.key}
                    changeType="changed"
                    sourceValue={d.sourceValue}
                    targetValue={d.targetValue}
                    sourceBg="#f0fff0"
                    targetBg="#fff0f0"
                  />
                ))}
                {dryRunResult.added.map((d) => (
                  <DryRunRow
                    key={d.key}
                    keyName={d.key}
                    changeType="added"
                    sourceValue={d.sourceValue}
                    sourceBg="#f0fff0"
                  />
                ))}
                {dryRunResult.removed.map((d) => (
                  <DryRunRow
                    key={d.key}
                    keyName={d.key}
                    changeType="removed"
                    targetValue={d.targetValue}
                    targetBg="#fff0f0"
                  />
                ))}
              </tbody>
            </Box>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Unchanged: {dryRunResult.unchangedCount} key(s)
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
