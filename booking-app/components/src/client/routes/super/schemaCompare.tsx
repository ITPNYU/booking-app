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
import { useCallback, useContext, useMemo, useState } from "react";
import { computeDiff, type DiffEntry } from "@/lib/utils/schemaDiff";
import { DatabaseContext } from "../components/Provider";
import { defaultScheme } from "../components/SchemaProvider";

/** Full JSON string — never truncated. */
function formatValueFull(val: unknown): string {
  if (val === undefined) return "(not set)";
  if (val === null) return "(null)";
  if (typeof val === "object") return JSON.stringify(val, null, 2);
  return String(val);
}

const COLLAPSE_AT = 120;

/** Value cell that respects row-level expanded state. */
function DiffValueCell({
  value,
  bg,
  expanded,
}: {
  value: unknown;
  bg?: string;
  expanded: boolean;
}) {
  const full = formatValueFull(value);
  const isLong = full.length > COLLAPSE_AT;

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
      {isLong && !expanded ? `${full.slice(0, COLLAPSE_AT)} ...` : full}
    </Box>
  );
}

/**
 * One diff row. Change type is relative to the right (target) column:
 * "added" = will be added to target, "removed" = will be removed from target,
 * "changed" = target value will be replaced by the left (source) value.
 */
function DiffRow({ entry }: { entry: DiffEntry }) {
  const [expanded, setExpanded] = useState(false);
  const sourceStr = formatValueFull(entry.newValue);
  const targetStr = formatValueFull(entry.oldValue);
  const isLong =
    sourceStr.length > COLLAPSE_AT || targetStr.length > COLLAPSE_AT;

  const color =
    entry.type === "changed"
      ? "warning.main"
      : entry.type === "added"
        ? "success.main"
        : "error.main";
  const sourceBg = entry.type !== "removed" ? "#f0fff0" : "#f5f5f5";
  const targetBg = entry.type !== "added" ? "#fff0f0" : "#f5f5f5";

  return (
    <tr>
      <Box
        component="td"
        sx={{
          p: 1,
          borderBottom: "1px solid #ddd",
          fontFamily: "monospace",
          fontSize: 12,
        }}
      >
        {entry.path}
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
      <Box
        component="td"
        sx={{
          p: 1,
          borderBottom: "1px solid #ddd",
          color,
          fontWeight: "bold",
        }}
      >
        {entry.type}
      </Box>
      <DiffValueCell value={entry.newValue} bg={sourceBg} expanded={expanded} />
      <DiffValueCell value={entry.oldValue} bg={targetBg} expanded={expanded} />
    </tr>
  );
}

/**
 * Shared table for the Difference view and the dry-run report so both render
 * identical rows for identical input.
 */
function SchemaDiffTable({
  diffs,
  leftLabel,
  rightLabel,
}: {
  diffs: DiffEntry[];
  leftLabel: string;
  rightLabel: string;
}) {
  const th = {
    textAlign: "left" as const,
    p: 1,
    borderBottom: "2px solid #ccc",
  };
  return (
    <Box
      component="table"
      sx={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
    >
      <thead>
        <tr>
          <Box component="th" sx={{ ...th, width: "25%" }}>
            Field
          </Box>
          <Box component="th" sx={{ ...th, width: "10%" }}>
            Change
          </Box>
          <Box component="th" sx={{ ...th, width: "32.5%" }}>
            {leftLabel}
          </Box>
          <Box component="th" sx={{ ...th, width: "32.5%" }}>
            {rightLabel}
          </Box>
        </tr>
      </thead>
      <tbody>
        {diffs.map((d) => (
          <DiffRow key={`${d.path}:${d.type}`} entry={d} />
        ))}
      </tbody>
    </Box>
  );
}

const ENVIRONMENTS = ["development", "staging", "production"] as const;
type Env = (typeof ENVIRONMENTS)[number];

const ALL_DEFAULT_KEYS = Object.keys(defaultScheme) as string[];

// ─── Schema Health Check ───
function SchemaHealthCheck({
  schemas,
}: {
  schemas: Record<string, any | null>;
}) {
  const healthData = useMemo(() => {
    const results: { env: string; missing: string[] }[] = [];
    for (const env of ENVIRONMENTS) {
      const schema = schemas[env];
      if (!schema) continue;
      const schemaKeys = Object.keys(schema);
      const missing = ALL_DEFAULT_KEYS.filter(
        (key) => !schemaKeys.includes(key),
      );
      if (missing.length > 0) {
        results.push({ env, missing });
      }
    }
    return results;
  }, [schemas]);

  if (healthData.length === 0) return null;

  return (
    <Alert severity="info" sx={{ mb: 2 }}>
      <Typography variant="body2" sx={{ mb: 1 }}>
        Schema Health: {healthData.length} environment(s) have unconfigured
        fields
      </Typography>
      {healthData.map(({ env, missing }) => (
        <Box key={env} sx={{ mt: 1 }}>
          <Typography variant="body2" fontWeight="bold">
            {env} — {missing.length} missing field(s):
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
            {missing.map((key) => (
              <Chip key={key} label={key} size="small" variant="outlined" />
            ))}
          </Box>
        </Box>
      ))}
    </Alert>
  );
}

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
  const [dryRunResult, setDryRunResult] = useState<DiffEntry[] | null>(null);
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
        const res = await fetch(`/api/tenantSchema/${tenantId}/compare`);
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
            message: `Overwrote "${tenant}" ${leftEnv} → ${rightEnv}. Backup: ${data.backupId ?? "N/A"}`,
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
  // Same orientation as the sync endpoint: old = right (target), new = left
  // (source), so change types read as "what Overwrite left → right does".
  const diffs: DiffEntry[] =
    leftSchema && rightSchema ? computeDiff(rightSchema, leftSchema) : [];

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Environment Schema Compare
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Compare tenantSchema across development, staging, and production. Change
        types describe what Overwrite (left → right) does to the right
        environment.
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
            onChange={(e) => {
              setLeftEnv(e.target.value as Env);
              setDryRunResult(null);
            }}
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
            onChange={(e) => {
              setRightEnv(e.target.value as Env);
              setDryRunResult(null);
            }}
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
            {leftEnv !== rightEnv && diffs.length > 0 && (
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
                  Overwrite {leftEnv} → {rightEnv}
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
            Dry Run Result — {leftEnv} → {rightEnv} ({dryRunResult.length}{" "}
            change(s), computed server-side from a fresh read)
          </Typography>
          {dryRunResult.length === 0 ? (
            <Typography variant="body2">
              No changes would be applied.
            </Typography>
          ) : (
            <SchemaDiffTable
              diffs={dryRunResult}
              leftLabel={`${leftEnv} (source)`}
              rightLabel={`${rightEnv} (target)`}
            />
          )}
        </Box>
      )}

      {tenant && !loading && (
        <>
          {/* Schema Health Check — unconfigured fields per environment */}
          <SchemaHealthCheck schemas={schemas} />

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
            <SchemaDiffTable
              diffs={diffs}
              leftLabel={leftEnv}
              rightLabel={rightEnv}
            />
          )}
        </>
      )}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirm Schema Overwrite</DialogTitle>
        <DialogContent>
          <Typography>
            Overwrite <strong>{rightEnv}</strong> schema for tenant{" "}
            <strong>{tenant}</strong> with the <strong>{leftEnv}</strong>{" "}
            version? This cannot be undone (a backup will be saved).
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
            Overwrite
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
