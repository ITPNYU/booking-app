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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useContext, useMemo, useState } from "react";

import { ALLOWED_TENANTS } from "@/components/src/constants/tenants";
import { DatabaseContext } from "../components/Provider";

type DiffEntry = {
  key: string;
  type: "added" | "removed" | "changed" | "unchanged";
  sourceValue?: unknown;
  targetValue?: unknown;
};

const ENVIRONMENTS = ["development", "staging", "production"] as const;

function computeDiff(
  source: Record<string, unknown> | null,
  target: Record<string, unknown> | null,
): DiffEntry[] {
  if (!source && !target) return [];
  if (!source) return [];
  if (!target) {
    return Object.keys(source).map((key) => ({
      key,
      type: "added",
      sourceValue: source[key],
    }));
  }

  const allKeys = new Set([...Object.keys(source), ...Object.keys(target)]);
  const entries: DiffEntry[] = [];

  for (const key of allKeys) {
    const inSource = key in source;
    const inTarget = key in target;

    if (inSource && !inTarget) {
      entries.push({ key, type: "added", sourceValue: source[key] });
    } else if (!inSource && inTarget) {
      entries.push({ key, type: "removed", targetValue: target[key] });
    } else {
      const same =
        JSON.stringify(source[key]) === JSON.stringify(target[key]);
      entries.push({
        key,
        type: same ? "unchanged" : "changed",
        sourceValue: source[key],
        targetValue: target[key],
      });
    }
  }

  // Show changes first, then added, removed, unchanged
  const order = { changed: 0, added: 1, removed: 2, unchanged: 3 };
  entries.sort((a, b) => order[a.type] - order[b.type]);
  return entries;
}

function formatValue(value: unknown): string {
  if (value === undefined) return "(none)";
  if (value === null) return "null";
  const str = JSON.stringify(value);
  return str.length > 120 ? str.slice(0, 120) + "..." : str;
}

const chipColor: Record<
  DiffEntry["type"],
  "error" | "success" | "warning" | "default"
> = {
  changed: "warning",
  added: "success",
  removed: "error",
  unchanged: "default",
};

export default function SchemaSync() {
  const { userEmail } = useContext(DatabaseContext);
  const [tenant, setTenant] = useState(ALLOWED_TENANTS[0]);
  const [sourceEnv, setSourceEnv] = useState<string>("development");
  const [targetEnv, setTargetEnv] = useState<string>("production");
  const [schemas, setSchemas] = useState<Record<
    string,
    Record<string, unknown> | null
  > | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<{
    added: string[];
    removed: string[];
    changed: string[];
    unchanged: string[];
  } | null>(null);
  const [dryRunning, setDryRunning] = useState(false);

  const diff = useMemo(() => {
    if (!schemas) return null;
    return computeDiff(schemas[sourceEnv], schemas[targetEnv]);
  }, [schemas, sourceEnv, targetEnv]);

  const changesCount = useMemo(() => {
    if (!diff) return 0;
    return diff.filter((d) => d.type !== "unchanged").length;
  }, [diff]);

  const handleCompare = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setSchemas(null);

    try {
      const res = await fetch(`/api/tenantSchema/${tenant}/compare`, {
        headers: { "x-user-email": userEmail ?? "" },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setSchemas(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDryRun = async () => {
    setDryRunning(true);
    setError(null);
    setSuccess(null);
    setDryRunResult(null);

    try {
      const res = await fetch(`/api/tenantSchema/${tenant}/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": userEmail ?? "",
        },
        body: JSON.stringify({ sourceEnv, targetEnv, dryRun: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setDryRunResult(data.diff);
      setSuccess(
        `Dry run complete: ${data.diff.added.length} added, ${data.diff.changed.length} changed, ${data.diff.removed.length} removed, ${data.diff.unchanged.length} unchanged.`,
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDryRunning(false);
    }
  };

  const handleSync = async () => {
    setConfirmOpen(false);
    setSyncing(true);
    setError(null);
    setSuccess(null);
    setDryRunResult(null);

    try {
      const res = await fetch(`/api/tenantSchema/${tenant}/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": userEmail ?? "",
        },
        body: JSON.stringify({ sourceEnv, targetEnv }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setSuccess(
        `Synced "${tenant}" from ${sourceEnv} to ${targetEnv}. Backup: ${data.backupId ?? "N/A (no existing schema)"}`,
      );
      // Refresh comparison
      handleCompare();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Schema Sync
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Compare and sync tenant schemas between environments. A backup is
        automatically created before overwriting.
      </Typography>

      <Box sx={{ display: "flex", gap: 2, mb: 3, alignItems: "center" }}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Tenant</InputLabel>
          <Select
            value={tenant}
            label="Tenant"
            onChange={(e) => {
              setTenant(e.target.value as (typeof ALLOWED_TENANTS)[number]);
              setSchemas(null);
            }}
          >
            {ALLOWED_TENANTS.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Source</InputLabel>
          <Select
            value={sourceEnv}
            label="Source"
            onChange={(e) => setSourceEnv(e.target.value)}
          >
            {ENVIRONMENTS.map((env) => (
              <MenuItem key={env} value={env}>
                {env}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Typography variant="body1">→</Typography>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Target</InputLabel>
          <Select
            value={targetEnv}
            label="Target"
            onChange={(e) => setTargetEnv(e.target.value)}
          >
            {ENVIRONMENTS.filter((env) => env !== sourceEnv).map((env) => (
              <MenuItem key={env} value={env}>
                {env}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="contained"
          onClick={handleCompare}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={18} /> : null}
        >
          Compare
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {diff && (
        <>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2,
            }}
          >
            <Typography variant="body2">
              {changesCount === 0
                ? "No differences found."
                : `${changesCount} difference(s) found.`}
            </Typography>
            {changesCount > 0 && (
              <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                variant="outlined"
                onClick={handleDryRun}
                disabled={dryRunning || syncing}
                startIcon={dryRunning ? <CircularProgress size={18} /> : null}
              >
                Dry Run
              </Button>
              <Button
                variant="contained"
                color="warning"
                onClick={() => setConfirmOpen(true)}
                disabled={syncing}
                startIcon={syncing ? <CircularProgress size={18} /> : null}
              >
                Sync {sourceEnv} → {targetEnv}
              </Button>
              </Box>
            )}
          </Box>

          {dryRunResult && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Dry Run Result (server-side verification)
              </Typography>
              {dryRunResult.added.length > 0 && (
                <Typography variant="body2">
                  Added: {dryRunResult.added.join(", ")}
                </Typography>
              )}
              {dryRunResult.changed.length > 0 && (
                <Typography variant="body2">
                  Changed: {dryRunResult.changed.join(", ")}
                </Typography>
              )}
              {dryRunResult.removed.length > 0 && (
                <Typography variant="body2">
                  Removed: {dryRunResult.removed.join(", ")}
                </Typography>
              )}
              {dryRunResult.added.length === 0 &&
                dryRunResult.changed.length === 0 &&
                dryRunResult.removed.length === 0 && (
                  <Typography variant="body2">
                    No changes would be applied.
                  </Typography>
                )}
            </Alert>
          )}

          <TableContainer
            sx={{ maxHeight: 600, border: "1px solid #e0e0e0", borderRadius: 1 }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "bold" }}>Key</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>
                    {sourceEnv}
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>
                    {targetEnv}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {diff
                  .filter((d) => d.type !== "unchanged")
                  .map((d) => (
                    <TableRow key={d.key}>
                      <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>
                        {d.key}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={d.type}
                          size="small"
                          color={chipColor[d.type]}
                        />
                      </TableCell>
                      <TableCell
                        sx={{
                          fontFamily: "monospace",
                          fontSize: 12,
                          maxWidth: 300,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatValue(d.sourceValue)}
                      </TableCell>
                      <TableCell
                        sx={{
                          fontFamily: "monospace",
                          fontSize: 12,
                          maxWidth: 300,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatValue(d.targetValue)}
                      </TableCell>
                    </TableRow>
                  ))}
                {diff.filter((d) => d.type !== "unchanged").length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      All keys are identical.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirm Schema Sync</DialogTitle>
        <DialogContent>
          <Typography>
            This will overwrite the <strong>{targetEnv}</strong> schema for
            tenant <strong>{tenant}</strong> with the{" "}
            <strong>{sourceEnv}</strong> version.
          </Typography>
          <Typography sx={{ mt: 1 }}>
            A backup of the current {targetEnv} schema will be saved to the{" "}
            <code>tenantSchemaBackup</code> collection before overwriting.
          </Typography>
          <Typography sx={{ mt: 1, fontWeight: "bold" }}>
            {changesCount} field(s) will change.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleSync}
          >
            Sync to {targetEnv}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
