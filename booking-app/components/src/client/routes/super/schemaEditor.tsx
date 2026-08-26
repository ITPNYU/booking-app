"use client";

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
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
import type { ChangeEvent } from "react";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { computeDiff, formatValue, type DiffEntry } from "@/lib/utils/schemaDiff";
import { DatabaseContext } from "../components/Provider";
import type { SchemaContextType } from "../components/SchemaProvider";
import { defaultScheme } from "../components/SchemaProvider";

type SnackState = {
  open: boolean;
  message: string;
  severity: "success" | "error";
};

// ─── Diff Confirmation Dialog ───
function DiffDialog({
  open,
  diffs,
  saving,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  diffs: DiffEntry[];
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="md" fullWidth>
      <DialogTitle>Confirm Changes</DialogTitle>
      <DialogContent dividers>
        {diffs.length === 0 ? (
          <Typography>No changes detected.</Typography>
        ) : (
          <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <Box component="th" sx={{ textAlign: "left", p: 1, borderBottom: "1px solid #ddd" }}>Field</Box>
                <Box component="th" sx={{ textAlign: "left", p: 1, borderBottom: "1px solid #ddd" }}>Change</Box>
                <Box component="th" sx={{ textAlign: "left", p: 1, borderBottom: "1px solid #ddd" }}>Before</Box>
                <Box component="th" sx={{ textAlign: "left", p: 1, borderBottom: "1px solid #ddd" }}>After</Box>
              </tr>
            </thead>
            <tbody>
              {diffs.map((d, i) => (
                <tr key={i}>
                  <Box
                    component="td"
                    sx={{ p: 1, borderBottom: "1px solid #eee", fontFamily: "monospace", fontSize: 12 }}
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
                      backgroundColor: d.type === "removed" || d.type === "changed" ? "#fff0f0" : undefined,
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
                      backgroundColor: d.type === "added" || d.type === "changed" ? "#f0fff0" : undefined,
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
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={saving || diffs.length === 0}
        >
          {saving ? <CircularProgress size={20} /> : `Save (${diffs.length} changes)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── JSON Editor ───
function JsonEditor({
  schema,
  onSchemaChange,
}: {
  schema: SchemaContextType;
  onSchemaChange: (schema: SchemaContextType) => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(schema, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);

  // Sync external schema changes into the text (e.g. on tenant switch)
  const lastExternalRef = useRef(JSON.stringify(schema));
  useEffect(() => {
    const incoming = JSON.stringify(schema);
    if (incoming !== lastExternalRef.current) {
      lastExternalRef.current = incoming;
      setText(JSON.stringify(schema, null, 2));
      setParseError(null);
    }
  }, [schema]);

  const handleChange = (value: string) => {
    setText(value);
    try {
      const parsed = JSON.parse(value);
      setParseError(null);
      lastExternalRef.current = JSON.stringify(parsed);
      onSchemaChange(parsed);
    } catch (e: any) {
      setParseError(e.message);
    }
  };

  return (
    <>
      {parseError && (
        <Alert severity="error" sx={{ mb: 1 }}>
          JSON Parse Error: {parseError}
        </Alert>
      )}
      <Box
        component="textarea"
        value={text}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
          handleChange(e.target.value)
        }
        spellCheck={false}
        sx={{
          width: "100%",
          minHeight: 500,
          fontFamily: "monospace",
          fontSize: 13,
          lineHeight: 1.5,
          p: 1.5,
          border: parseError ? "2px solid #d32f2f" : "1px solid #ccc",
          borderRadius: 1,
          resize: "vertical",
          tabSize: 2,
          whiteSpace: "pre",
          overflowWrap: "normal",
          overflowX: "auto",
        }}
      />
    </>
  );
}

function UnconfiguredFieldsBanner({
  schema,
}: {
  schema: SchemaContextType;
}) {
  const [expanded, setExpanded] = useState(false);

  const allDefaultKeys = Object.keys(defaultScheme) as string[];
  const schemaKeys = Object.keys(schema);
  const unconfigured = allDefaultKeys.filter((key) => !schemaKeys.includes(key));

  if (unconfigured.length === 0) return null;

  return (
    <Alert
      severity="warning"
      sx={{ mb: 2 }}
      action={
        <Button
          color="inherit"
          size="small"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? "Hide" : "Show"}
        </Button>
      }
    >
      <Typography variant="body2">
        {unconfigured.length} field(s) not configured in Firestore (using code defaults)
      </Typography>
      <Collapse in={expanded}>
        <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {unconfigured.map((key) => (
            <Chip
              key={key}
              label={key}
              size="small"
              variant="outlined"
              color="warning"
            />
          ))}
        </Box>
      </Collapse>
    </Alert>
  );
}

// ─── Main Component ───
export default function SchemaEditor() {
  const { userEmail } = useContext(DatabaseContext);
  const [tenant, setTenant] = useState<string>("");
  const [schema, setSchema] = useState<SchemaContextType | null>(null);
  const [originalSchema, setOriginalSchema] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [diffDialogOpen, setDiffDialogOpen] = useState(false);
  const [diffs, setDiffs] = useState<DiffEntry[]>([]);
  const [snack, setSnack] = useState<SnackState>({
    open: false,
    message: "",
    severity: "success",
  });

  const fetchSchema = useCallback(async (tenantId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tenantSchema/${tenantId}?raw=1`);
      if (!res.ok) throw new Error(`Failed to fetch schema: ${res.status}`);
      const data = await res.json();
      setSchema(data);
      setOriginalSchema(JSON.stringify(data));
    } catch (err: any) {
      setSnack({ open: true, message: err.message, severity: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tenant) {
      fetchSchema(tenant);
    } else {
      setSchema(null);
      setOriginalSchema("");
    }
  }, [tenant, fetchSchema]);

  // Open diff dialog instead of saving directly
  const handleSaveClick = () => {
    if (!schema || !originalSchema) return;
    const original = JSON.parse(originalSchema);
    const d = computeDiff(original, schema);
    setDiffs(d);
    setDiffDialogOpen(true);
  };

  // Actual save after confirmation
  const handleConfirmSave = async () => {
    if (!tenant || !userEmail || !schema) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/tenantSchema/${tenant}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(schema),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || `Failed: ${res.status}`);
      }

      setOriginalSchema(JSON.stringify(schema));
      setDiffDialogOpen(false);
      const backupMsg = result.backupCreated
        ? " A backup of the previous schema was created."
        : "";
      setSnack({
        open: true,
        message: `Schema for "${tenant}" saved successfully.${backupMsg}`,
        severity: "success",
      });
    } catch (err: any) {
      setSnack({ open: true, message: err.message, severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (originalSchema) {
      setSchema(JSON.parse(originalSchema));
    }
  };

  const isDirty = schema
    ? computeDiff(JSON.parse(originalSchema), schema).length > 0
    : false;
  const canSave = isDirty && !saving && !!tenant;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Tenant Schema Editor
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        A backup is created automatically before each save.
      </Typography>

      <Box display="flex" gap={2} alignItems="center" mb={2} flexWrap="wrap">
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Tenant</InputLabel>
          <Select
            value={tenant}
            label="Tenant"
            onChange={(e) => setTenant(e.target.value)}
          >
            {["mc", "itp"].map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {canSave && (
          <>
            <Button
              variant="contained"
              onClick={handleSaveClick}
              disabled={saving}
            >
              Save
            </Button>
            <Button variant="outlined" color="secondary" onClick={handleReset}>
              Reset
            </Button>
            <Typography variant="body2" color="warning.main">
              Unsaved changes
            </Typography>
          </>
        )}
      </Box>

      {loading && (
        <Box display="flex" alignItems="center" gap={1} my={2}>
          <CircularProgress size={20} />
          <Typography variant="body2">Loading schema...</Typography>
        </Box>
      )}

      {schema && !loading && (
        <UnconfiguredFieldsBanner schema={schema} />
      )}

      {schema && !loading && (
        <JsonEditor
          schema={schema}
          onSchemaChange={(updated) => setSchema(updated)}
        />
      )}

      <DiffDialog
        open={diffDialogOpen}
        diffs={diffs}
        saving={saving}
        onConfirm={handleConfirmSave}
        onCancel={() => setDiffDialogOpen(false)}
      />

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
