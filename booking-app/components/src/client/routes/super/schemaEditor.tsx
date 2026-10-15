"use client";

import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
  MenuItem,
  Select,
  Snackbar,
  Typography,
} from "@mui/material";
import type { ChangeEvent, ReactNode } from "react";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  computeDiff,
  formatValue,
  type DiffEntry,
} from "@/lib/utils/schemaDiff";
import { DatabaseContext } from "../components/Provider";
import { defaultScheme } from "../components/SchemaProvider";
import {
  getSlice,
  isDirtyUnder,
  isSameSelection,
  pathPrefix,
  resourceLabelForPath,
  resourceLabels,
  SELECT_ALL,
  sectionKeys,
  selectionId,
  setSlice,
  type Selection,
} from "./schemaEditorNav";

type SnackState = {
  open: boolean;
  message: string;
  severity: "success" | "error";
};

type AnyRecord = Record<string, unknown>;

const DEFAULTS = defaultScheme as unknown as AnyRecord;

// ─── Diff Confirmation Dialog ───
function DiffDialog({
  open,
  diffs,
  saving,
  labelFor,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  diffs: DiffEntry[];
  saving: boolean;
  labelFor: (path: string) => string | undefined;
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
          <Box
            component="table"
            sx={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
          >
            <thead>
              <tr>
                <Box
                  component="th"
                  sx={{
                    textAlign: "left",
                    p: 1,
                    borderBottom: "1px solid #ddd",
                  }}
                >
                  Field
                </Box>
                <Box
                  component="th"
                  sx={{
                    textAlign: "left",
                    p: 1,
                    borderBottom: "1px solid #ddd",
                  }}
                >
                  Change
                </Box>
                <Box
                  component="th"
                  sx={{
                    textAlign: "left",
                    p: 1,
                    borderBottom: "1px solid #ddd",
                  }}
                >
                  Before
                </Box>
                <Box
                  component="th"
                  sx={{
                    textAlign: "left",
                    p: 1,
                    borderBottom: "1px solid #ddd",
                  }}
                >
                  After
                </Box>
              </tr>
            </thead>
            <tbody>
              {diffs.map((d, i) => {
                const label = labelFor(d.path);
                return (
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
                      {label && (
                        <Typography
                          component="div"
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontFamily: "inherit" }}
                        >
                          {label}
                        </Typography>
                      )}
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
                );
              })}
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
          {saving ? (
            <CircularProgress size={20} />
          ) : (
            `Save (${diffs.length} changes)`
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── JSON Editor (one slice of the schema) ───
function JsonEditor({
  value,
  onChange,
  onParseErrorChange,
  minHeight = 500,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
  /** Reports whether the textarea currently holds text that does not parse. */
  onParseErrorChange?: (hasError: boolean) => void;
  minHeight?: number;
}) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);

  // Sync external value changes into the text (e.g. on reset)
  const lastExternalRef = useRef(JSON.stringify(value));
  useEffect(() => {
    const incoming = JSON.stringify(value);
    if (incoming !== lastExternalRef.current) {
      lastExternalRef.current = incoming;
      setText(JSON.stringify(value, null, 2));
      setParseError(null);
    }
  }, [value]);

  const handleChange = (next: string) => {
    setText(next);
    try {
      const parsed = JSON.parse(next);
      setParseError(null);
      onParseErrorChange?.(false);
      lastExternalRef.current = JSON.stringify(parsed);
      onChange(parsed);
    } catch (e: any) {
      setParseError(e.message);
      onParseErrorChange?.(true);
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
          minHeight,
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

function DirtyDot() {
  return (
    <Box
      component="span"
      title="Unsaved changes"
      sx={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        bgcolor: "warning.main",
        ml: 1,
        flexShrink: 0,
      }}
    />
  );
}

// ─── Sidebar ───
function SectionNav({
  schema,
  diffs,
  selected,
  onSelect,
}: {
  schema: AnyRecord;
  diffs: DiffEntry[];
  selected: Selection;
  onSelect: (sel: Selection) => void;
}) {
  const [resourcesOpen, setResourcesOpen] = useState(true);
  const keys = useMemo(() => sectionKeys(schema, DEFAULTS), [schema]);
  const resources = useMemo(() => resourceLabels(schema), [schema]);

  const item = (
    sel: Selection,
    primary: string,
    opts: {
      secondary?: string;
      muted?: boolean;
      indent?: number;
      trailing?: ReactNode;
    } = {},
  ) => (
    <ListItemButton
      key={selectionId(sel)}
      selected={isSameSelection(sel, selected)}
      onClick={() => onSelect(sel)}
      sx={{ pl: 2 + (opts.indent ?? 0), py: 0.5 }}
    >
      <ListItemText
        primary={primary}
        secondary={opts.secondary}
        primaryTypographyProps={{
          fontFamily: opts.indent ? undefined : "monospace",
          fontSize: 13,
          color: opts.muted ? "text.disabled" : undefined,
          noWrap: true,
        }}
        secondaryTypographyProps={{ fontSize: 11, noWrap: true }}
      />
      {opts.trailing}
      {isDirtyUnder(diffs, pathPrefix(sel)) && <DirtyDot />}
    </ListItemButton>
  );

  return (
    <List
      dense
      disablePadding
      subheader={
        <ListSubheader disableSticky sx={{ lineHeight: "32px" }}>
          Sections
        </ListSubheader>
      }
    >
      {item(SELECT_ALL, "All (raw JSON)")}
      <Divider sx={{ my: 0.5 }} />
      {keys.map(({ key, present }) => {
        if (key !== "resources") {
          return item(
            { kind: "section", key },
            key,
            present
              ? {}
              : { muted: true, secondary: "not configured (code default)" },
          );
        }
        return (
          <Box key="resources-group">
            {item({ kind: "section", key }, key, {
              secondary: `${resources.length} items`,
              trailing: (
                <IconButton
                  size="small"
                  edge="end"
                  aria-label={
                    resourcesOpen ? "Collapse resources" : "Expand resources"
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    setResourcesOpen((o) => !o);
                  }}
                >
                  {resourcesOpen ? (
                    <ExpandLessIcon fontSize="small" />
                  ) : (
                    <ExpandMoreIcon fontSize="small" />
                  )}
                </IconButton>
              ),
            })}
            <Collapse in={resourcesOpen}>
              {resources.map((r) =>
                item({ kind: "resource", index: r.index }, r.name, {
                  indent: r.parentResourceId ? 4 : 2,
                  secondary: [
                    r.resourceId ? `id ${r.resourceId}` : null,
                    r.isEquipment ? "equipment" : null,
                    r.parentResourceId
                      ? `annex of ${r.parentResourceId}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                }),
              )}
            </Collapse>
          </Box>
        );
      })}
    </List>
  );
}

function UnconfiguredFieldsBanner({ schema }: { schema: AnyRecord }) {
  const [expanded, setExpanded] = useState(false);

  const allDefaultKeys = Object.keys(DEFAULTS);
  const schemaKeys = Object.keys(schema);
  const unconfigured = allDefaultKeys.filter(
    (key) => !schemaKeys.includes(key),
  );

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
        {unconfigured.length} field(s) not configured in Firestore (using code
        defaults)
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
  const [schema, setSchema] = useState<AnyRecord | null>(null);
  const [originalSchema, setOriginalSchema] = useState<string>("");
  const [selected, setSelected] = useState<Selection>(SELECT_ALL);
  // True while the textarea holds text that does not parse. Such text has
  // not reached `schema`, so leaving the slice would discard it.
  const [hasParseError, setHasParseError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [diffDialogOpen, setDiffDialogOpen] = useState(false);
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

  const original = useMemo<AnyRecord | null>(
    () => (originalSchema ? JSON.parse(originalSchema) : null),
    [originalSchema],
  );

  const diffs = useMemo<DiffEntry[]>(
    () => (schema && original ? computeDiff(original, schema) : []),
    [schema, original],
  );

  // A resource selection can go stale (tenant switch, item removed in the
  // raw view); fall back to the resources section in that case.
  const effectiveSelected = useMemo<Selection>(() => {
    if (selected.kind !== "resource" || !schema) return selected;
    const list = Array.isArray(schema.resources) ? schema.resources : [];
    return selected.index < list.length
      ? selected
      : { kind: "section", key: "resources" };
  }, [selected, schema]);

  const handleSaveClick = () => {
    if (!schema || !original || hasParseError) return;
    setDiffDialogOpen(true);
  };

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
    if (!original) return;
    setSchema(original);
    setHasParseError(false);
  };

  /** Leaving a slice remounts the editor; confirm first if it holds unparsed text. */
  const confirmLeaveSlice = (): boolean => {
    if (!hasParseError) return true;
    const ok = window.confirm(
      "The JSON in the editor has a syntax error. Text typed since it last parsed has not been kept and will be discarded if you switch. Switch anyway?",
    );
    if (ok) setHasParseError(false);
    return ok;
  };

  const handleSelect = (sel: Selection) => {
    if (isSameSelection(sel, effectiveSelected)) return;
    if (!confirmLeaveSlice()) return;
    setSelected(sel);
  };

  const handleTenantChange = (next: string) => {
    if (next === tenant) return;
    if (!confirmLeaveSlice()) return;
    setTenant(next);
  };

  const isDirty = diffs.length > 0;
  const canSave = isDirty && !saving && !!tenant;

  const labelFor = useCallback(
    (path: string) =>
      schema && original
        ? resourceLabelForPath(path, original, schema)
        : undefined,
    [schema, original],
  );

  const sliceValue = schema
    ? getSlice(schema, effectiveSelected, DEFAULTS)
    : undefined;
  const currentResource =
    effectiveSelected.kind === "resource" && schema
      ? resourceLabels(schema)[effectiveSelected.index]
      : undefined;
  const sectionUnconfigured =
    effectiveSelected.kind === "section" && schema
      ? !(effectiveSelected.key in schema)
      : false;

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
            onChange={(e) => handleTenantChange(e.target.value)}
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
              disabled={saving || hasParseError}
            >
              Save
            </Button>
            <Button variant="outlined" color="secondary" onClick={handleReset}>
              Reset
            </Button>
            <Typography
              variant="body2"
              color={hasParseError ? "error.main" : "warning.main"}
            >
              {hasParseError
                ? "Fix the JSON syntax error in the editor to save"
                : `${diffs.length} unsaved change${diffs.length === 1 ? "" : "s"}`}
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

      {schema && !loading && <UnconfiguredFieldsBanner schema={schema} />}

      {schema && !loading && (
        <Box display="flex" gap={2} alignItems="flex-start">
          <Box
            sx={{
              width: 280,
              flexShrink: 0,
              position: "sticky",
              top: 16,
              maxHeight: "calc(100vh - 32px)",
              overflowY: "auto",
              border: "1px solid #ddd",
              borderRadius: 1,
            }}
          >
            <SectionNav
              schema={schema}
              diffs={diffs}
              selected={effectiveSelected}
              onSelect={handleSelect}
            />
          </Box>

          <Box flex={1} minWidth={0}>
            <Box
              sx={{
                position: "sticky",
                top: 16,
                zIndex: 1,
                bgcolor: "background.paper",
                border: "1px solid #ddd",
                borderRadius: 1,
                px: 2,
                py: 1,
                mb: 1,
                display: "flex",
                alignItems: "center",
                gap: 1,
                flexWrap: "wrap",
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Editing:
              </Typography>
              <Breadcrumbs
                separator="›"
                sx={{ fontFamily: "monospace", fontSize: 14 }}
              >
                <span>{tenant}</span>
                {effectiveSelected.kind === "all" && (
                  <strong>(entire schema)</strong>
                )}
                {effectiveSelected.kind === "section" && (
                  <strong>{effectiveSelected.key}</strong>
                )}
                {effectiveSelected.kind === "resource" && (
                  <span>resources</span>
                )}
                {currentResource && (
                  <strong>
                    {currentResource.name}
                    {currentResource.resourceId
                      ? ` (resourceId ${currentResource.resourceId})`
                      : ""}
                  </strong>
                )}
              </Breadcrumbs>
              {currentResource?.isEquipment && (
                <Chip label="equipment" size="small" variant="outlined" />
              )}
              {currentResource?.parentResourceId && (
                <Chip
                  label={`annex of ${currentResource.parentResourceId}`}
                  size="small"
                  variant="outlined"
                />
              )}
              {sectionUnconfigured && (
                <Chip
                  label="not in Firestore, showing code default"
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              )}
            </Box>

            <JsonEditor
              key={`${tenant}:${selectionId(effectiveSelected)}`}
              value={sliceValue}
              onChange={(updated) =>
                setSchema((prev) =>
                  prev
                    ? setSlice(prev, effectiveSelected, updated, {
                        original: original ?? undefined,
                        fallback: DEFAULTS,
                      })
                    : prev,
                )
              }
              onParseErrorChange={setHasParseError}
              minHeight={effectiveSelected.kind === "all" ? 600 : 400}
            />
          </Box>
        </Box>
      )}

      <DiffDialog
        open={diffDialogOpen}
        diffs={diffs}
        saving={saving}
        labelFor={labelFor}
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
