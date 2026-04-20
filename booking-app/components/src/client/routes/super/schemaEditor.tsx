"use client";

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import type { ChangeEvent } from "react";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { DatabaseContext } from "../components/Provider";
import type {
  SchemaContextType,
  Resource,
  Agreement,
} from "../components/SchemaProvider";
import { defaultResource, defaultScheme } from "../components/SchemaProvider";
import {
  computeDiff,
  formatValue,
  setNestedValue,
  type DiffEntry,
} from "./schemaEditorUtils";

type SnackState = {
  open: boolean;
  message: string;
  severity: "success" | "error";
};

type EditorMode = "form" | "json";

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

// ─── Section: Basic Info ───
function BasicInfoSection({
  schema,
  onChange,
}: {
  schema: SchemaContextType;
  onChange: (path: string, value: any) => void;
}) {
  const fields = [
    { key: "name", label: "Name" },
    { key: "logo", label: "Logo URL" },
    { key: "nameForPolicy", label: "Name for Policy" },
    { key: "resourceName", label: "Resource Name" },
    { key: "safetyTrainingGoogleFormId", label: "Safety Training Google Form ID" },
  ];

  return (
    <>
      {fields.map((f) => (
        <TextField
          key={f.key}
          label={f.label}
          value={(schema as any)[f.key] ?? ""}
          onChange={(e) => onChange(f.key, e.target.value)}
          fullWidth
          size="small"
          sx={{ mb: 2 }}
        />
      ))}
      <TextField
        label="Declined Grace Period (hours)"
        type="number"
        value={schema.declinedGracePeriod ?? ""}
        onChange={(e) =>
          onChange("declinedGracePeriod", Number(e.target.value) || 0)
        }
        size="small"
        sx={{ mb: 2 }}
      />
      <TextField
        label="Bookings dashboard: highlight pending after (hours)"
        type="number"
        value={schema.interimHighlightThresholdHours ?? ""}
        onChange={(e) =>
          onChange(
            "interimHighlightThresholdHours",
            Number(e.target.value) || 0,
          )
        }
        size="small"
        sx={{ mb: 2 }}
        helperText="Dashboard row highlight when pending time (hours) reaches this value."
      />
    </>
  );
}

// ─── Section: Feature Toggles ───
function FeatureTogglesSection({
  schema,
  onChange,
}: {
  schema: SchemaContextType;
  onChange: (path: string, value: any) => void;
}) {
  const toggles = [
    { key: "showNNumber", label: "Show N-Number" },
    { key: "showSponsor", label: "Show Sponsor" },
    { key: "showSetup", label: "Show Setup" },
    { key: "showEquipment", label: "Show Equipment" },
    { key: "showStaffing", label: "Show Staffing" },
    { key: "showCatering", label: "Show Catering" },
    { key: "showHireSecurity", label: "Show Hire Security" },
    { key: "showBookingTypes", label: "Show Booking Types" },
    { key: "supportVIP", label: "Support VIP" },
    { key: "supportWalkIn", label: "Support Walk-In" },
  ];

  return (
    <Box display="flex" flexWrap="wrap" gap={1}>
      {toggles.map((t) => (
        <FormControlLabel
          key={t.key}
          control={
            <Switch
              checked={(schema as any)[t.key] ?? false}
              onChange={(e) => onChange(t.key, e.target.checked)}
            />
          }
          label={t.label}
          sx={{ minWidth: 200 }}
        />
      ))}
    </Box>
  );
}

// ─── Section: Policy ───
function PolicySection({
  schema,
  onChange,
}: {
  schema: SchemaContextType;
  onChange: (path: string, value: any) => void;
}) {
  return (
    <TextField
      label="Policy (HTML)"
      value={schema.policy ?? ""}
      onChange={(e) => onChange("policy", e.target.value)}
      fullWidth
      multiline
      minRows={4}
      maxRows={12}
      size="small"
    />
  );
}

// ─── Section: Email Messages ───
function EmailMessagesSection({
  schema,
  onChange,
}: {
  schema: SchemaContextType;
  onChange: (path: string, value: any) => void;
}) {
  const messages = schema.emailMessages;
  if (!messages) return null;

  const fields = [
    { key: "requestConfirmation", label: "Request Confirmation" },
    { key: "firstApprovalRequest", label: "First Approval Request" },
    { key: "secondApprovalRequest", label: "Second Approval Request" },
    { key: "walkInConfirmation", label: "Walk-In Confirmation" },
    { key: "vipConfirmation", label: "VIP Confirmation" },
    { key: "checkoutConfirmation", label: "Checkout Confirmation" },
    { key: "checkinConfirmation", label: "Check-in Confirmation" },
    { key: "declined", label: "Declined" },
    { key: "canceled", label: "Canceled" },
    { key: "lateCancel", label: "Late Cancel" },
    { key: "noShow", label: "No Show" },
    { key: "closed", label: "Closed" },
    { key: "approvalNotice", label: "Approval Notice" },
  ];

  return (
    <>
      {fields.map((f) => (
        <TextField
          key={f.key}
          label={f.label}
          value={(messages as any)[f.key] ?? ""}
          onChange={(e) =>
            onChange(`emailMessages.${f.key}`, e.target.value)
          }
          fullWidth
          multiline
          minRows={2}
          maxRows={6}
          size="small"
          sx={{ mb: 2 }}
        />
      ))}
    </>
  );
}

// ─── Section: Agreements ───
function AgreementsSection({
  schema,
  onUpdateSchema,
}: {
  schema: SchemaContextType;
  onUpdateSchema: (fn: (prev: SchemaContextType) => SchemaContextType) => void;
}) {
  const agreements = schema.agreements ?? [];

  const updateAgreement = (index: number, field: keyof Agreement, value: string) => {
    onUpdateSchema((prev) => {
      const updated = [...(prev.agreements ?? [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, agreements: updated };
    });
  };

  const addAgreement = () => {
    onUpdateSchema((prev) => ({
      ...prev,
      agreements: [...(prev.agreements ?? []), { id: "", html: "" }],
    }));
  };

  const removeAgreement = (index: number) => {
    onUpdateSchema((prev) => ({
      ...prev,
      agreements: (prev.agreements ?? []).filter((_, i) => i !== index),
    }));
  };

  return (
    <>
      {agreements.map((ag, i) => (
        <Box key={ag.id || `agreement-${i}`} sx={{ mb: 2, p: 2, border: "1px solid #e0e0e0", borderRadius: 1 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="subtitle2">Agreement {i + 1}</Typography>
            <IconButton size="small" onClick={() => removeAgreement(i)} color="error">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
          <TextField
            label="ID"
            value={ag.id ?? ""}
            onChange={(e) => updateAgreement(i, "id", e.target.value)}
            fullWidth
            size="small"
            sx={{ mb: 1 }}
          />
          <TextField
            label="HTML Content"
            value={ag.html ?? ""}
            onChange={(e) => updateAgreement(i, "html", e.target.value)}
            fullWidth
            multiline
            minRows={2}
            maxRows={8}
            size="small"
          />
        </Box>
      ))}
      <Button startIcon={<AddIcon />} onClick={addAgreement} size="small">
        Add Agreement
      </Button>
    </>
  );
}

// ─── Section: Resources ───
function ResourceEditor({
  resource,
  index,
  onUpdate,
  onRemove,
}: {
  resource: Resource;
  index: number;
  onUpdate: (index: number, resource: Resource) => void;
  onRemove: (index: number) => void;
}) {
  const set = (field: string, value: any) => {
    const keys = field.split(".");
    if (keys.length === 1) {
      onUpdate(index, { ...resource, [field]: value });
    } else {
      const updated = setNestedValue(resource, field, value);
      onUpdate(index, updated);
    }
  };

  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box display="flex" alignItems="center" gap={1} width="100%">
          <Typography variant="subtitle2">
            {resource.name || `Resource ${index + 1}`}
            {resource.roomId ? ` (Room ${resource.roomId})` : ""}
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Box display="flex" gap={2} flexWrap="wrap" mb={2}>
          <TextField
            label="Name"
            value={resource.name ?? ""}
            onChange={(e) => set("name", e.target.value)}
            size="small"
          />
          <TextField
            label="Room ID"
            type="number"
            value={resource.roomId ?? 0}
            onChange={(e) => set("roomId", Number(e.target.value))}
            size="small"
            sx={{ width: 120 }}
          />
          <TextField
            label="Capacity"
            type="number"
            value={resource.capacity ?? 0}
            onChange={(e) => set("capacity", Number(e.target.value))}
            size="small"
            sx={{ width: 120 }}
          />
          <TextField
            label="Calendar ID"
            value={resource.calendarId ?? ""}
            onChange={(e) => set("calendarId", e.target.value)}
            size="small"
            sx={{ minWidth: 300 }}
          />
          <TextField
            label="Calendar ID (Prod)"
            value={resource.calendarIdProd ?? ""}
            onChange={(e) => set("calendarIdProd", e.target.value)}
            size="small"
            sx={{ minWidth: 300 }}
          />
        </Box>

        <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
          {[
            { key: "isEquipment", label: "Equipment" },
            { key: "isWalkIn", label: "Walk-In" },
            { key: "isWalkInCanBookTwo", label: "Walk-In Can Book Two" },
            { key: "needsSafetyTraining", label: "Needs Safety Training" },
          ].map((t) => (
            <FormControlLabel
              key={t.key}
              control={
                <Switch
                  checked={(resource as any)[t.key] ?? false}
                  onChange={(e) => set(t.key, e.target.checked)}
                  size="small"
                />
              }
              label={t.label}
            />
          ))}
        </Box>

        <TextField
          label="Training Form URL"
          value={resource.trainingFormUrl ?? ""}
          onChange={(e) => set("trainingFormUrl", e.target.value)}
          fullWidth
          size="small"
          sx={{ mb: 2 }}
        />

        <TextField
          label="Training Info URL"
          value={resource.trainingInfoUrl ?? ""}
          onChange={(e) => set("trainingInfoUrl", e.target.value)}
          fullWidth
          size="small"
          sx={{ mb: 2 }}
          helperText="Displayed in the safety training required alert as the Sign up here link."
        />

        <TextField
          label="Services (comma-separated)"
          value={
            Array.isArray(resource.services)
              ? resource.services
                  .map((s) =>
                    typeof s === "string" ? s : s && typeof s === "object" ? s.type : null,
                  )
                  .filter(Boolean)
                  .join(", ")
              : ""
          }
          onChange={(e) => {
            const newTypes = e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            const existing: Record<string, string[]> = {};
            if (Array.isArray(resource.services)) {
              resource.services.forEach((s) => {
                if (s && typeof s === "object") existing[s.type] = s.approvers;
              });
            }
            set(
              "services",
              newTypes.map((type) => ({ type, approvers: existing[type] ?? [] })),
            );
          }}
          fullWidth
          size="small"
          sx={{ mb: 2 }}
          helperText="e.g. equipment, staffing, setup, security, cleaning, catering — approvers are managed in Admin › Settings › Approvers"
        />

        <TextField
          label="Staffing Services (comma-separated)"
          value={Array.isArray(resource.staffingServices) ? resource.staffingServices.join(", ") : ""}
          onChange={(e) =>
            set(
              "staffingServices",
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          fullWidth
          size="small"
          sx={{ mb: 2 }}
        />

        {/* Max/Min Hours */}
        {resource.maxHour && (
          <Accordion sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2">Max Hours</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {Object.entries(resource.maxHour).map(([role, val]) => (
                  <TextField
                    key={role}
                    label={role}
                    type="number"
                    value={val ?? -1}
                    onChange={(e) =>
                      set(`maxHour.${role}`, Number(e.target.value))
                    }
                    size="small"
                    sx={{ width: 140 }}
                  />
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        )}

        {resource.minHour && (
          <Accordion sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2">Min Hours</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {Object.entries(resource.minHour).map(([role, val]) => (
                  <TextField
                    key={role}
                    label={role}
                    type="number"
                    value={val ?? -1}
                    onChange={(e) =>
                      set(`minHour.${role}`, Number(e.target.value))
                    }
                    size="small"
                    sx={{ width: 140 }}
                  />
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Auto Approval */}
        {resource.autoApproval && (
          <Accordion sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2">Auto Approval</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {resource.autoApproval.minHour && (
                <Box mb={1}>
                  <Typography variant="caption">Min Hour</Typography>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {Object.entries(resource.autoApproval.minHour).map(
                      ([role, val]) => (
                        <TextField
                          key={role}
                          label={role}
                          type="number"
                          value={val ?? -1}
                          onChange={(e) =>
                            set(
                              `autoApproval.minHour.${role}`,
                              Number(e.target.value),
                            )
                          }
                          size="small"
                          sx={{ width: 120 }}
                        />
                      ),
                    )}
                  </Box>
                </Box>
              )}
              {resource.autoApproval.maxHour && (
                <Box mb={1}>
                  <Typography variant="caption">Max Hour</Typography>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {Object.entries(resource.autoApproval.maxHour).map(
                      ([role, val]) => (
                        <TextField
                          key={role}
                          label={role}
                          type="number"
                          value={val ?? -1}
                          onChange={(e) =>
                            set(
                              `autoApproval.maxHour.${role}`,
                              Number(e.target.value),
                            )
                          }
                          size="small"
                          sx={{ width: 120 }}
                        />
                      ),
                    )}
                  </Box>
                </Box>
              )}
              {resource.autoApproval.conditions && (
                <Box>
                  <Typography variant="caption">Conditions</Typography>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {Object.entries(resource.autoApproval.conditions).map(
                      ([key, val]) => (
                        <FormControlLabel
                          key={key}
                          control={
                            <Switch
                              checked={val ?? false}
                              onChange={(e) =>
                                set(
                                  `autoApproval.conditions.${key}`,
                                  e.target.checked,
                                )
                              }
                              size="small"
                            />
                          }
                          label={key}
                        />
                      ),
                    )}
                  </Box>
                </Box>
              )}
            </AccordionDetails>
          </Accordion>
        )}

        <Box display="flex" justifyContent="flex-end" mt={1}>
          <Button
            color="error"
            size="small"
            startIcon={<DeleteIcon />}
            onClick={() => onRemove(index)}
          >
            Remove Resource
          </Button>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}

function ResourcesSection({
  schema,
  onUpdateSchema,
}: {
  schema: SchemaContextType;
  onUpdateSchema: (fn: (prev: SchemaContextType) => SchemaContextType) => void;
}) {
  const resources = schema.resources ?? [];

  const updateResource = (index: number, resource: Resource) => {
    onUpdateSchema((prev) => {
      const updated = [...(prev.resources ?? [])];
      updated[index] = resource;
      return { ...prev, resources: updated };
    });
  };

  const removeResource = (index: number) => {
    onUpdateSchema((prev) => ({
      ...prev,
      resources: (prev.resources ?? []).filter((_, i) => i !== index),
    }));
  };

  const addResource = () => {
    onUpdateSchema((prev) => ({
      ...prev,
      resources: [...(prev.resources ?? []), { ...defaultResource }],
    }));
  };

  return (
    <>
      {resources.map((r, i) => (
        <ResourceEditor
          key={r.roomId || `resource-${i}`}
          resource={r}
          index={i}
          onUpdate={updateResource}
          onRemove={removeResource}
        />
      ))}
      <Button startIcon={<AddIcon />} onClick={addResource} size="small" sx={{ mt: 1 }}>
        Add Resource
      </Button>
    </>
  );
}

// ─── Section: Mappings ───
function MappingEditor({
  label,
  mapping,
  onChange,
}: {
  label: string;
  mapping: Record<string, string[]>;
  onChange: (updated: Record<string, string[]>) => void;
}) {
  const entries = Object.entries(mapping ?? {});

  const updateKey = (oldKey: string, newKey: string) => {
    const updated = { ...mapping };
    const value = updated[oldKey];
    delete updated[oldKey];
    updated[newKey] = value;
    onChange(updated);
  };

  const updateValues = (key: string, values: string[]) => {
    onChange({ ...mapping, [key]: values });
  };

  const addEntry = () => {
    const tempKey = `new_key_${Date.now()}`;
    onChange({ ...mapping, [tempKey]: [] });
  };

  const removeEntry = (key: string) => {
    const updated = { ...mapping };
    delete updated[key];
    onChange(updated);
  };

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {label}
      </Typography>
      {entries.map(([key, values], i) => (
        <Box key={key || `entry-${i}`} display="flex" gap={1} mb={1} alignItems="center">
          <TextField
            label="Key"
            value={key}
            onChange={(e) => updateKey(key, e.target.value)}
            size="small"
            sx={{ width: 200 }}
          />
          <TextField
            label="Values (comma-separated)"
            value={
              Array.isArray(values)
                ? values.join(", ")
                : typeof values === "object" && values !== null
                  ? Object.values(values).filter(Boolean).join(", ")
                  : String(values ?? "")
            }
            onChange={(e) =>
              updateValues(
                key,
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
            size="small"
            sx={{ flex: 1 }}
          />
          <IconButton size="small" onClick={() => removeEntry(key)} color="error">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Button startIcon={<AddIcon />} onClick={addEntry} size="small">
        Add Entry
      </Button>
    </Box>
  );
}

function MappingsSection({
  schema,
  onChange,
  onUpdateSchema,
}: {
  schema: SchemaContextType;
  onChange: (path: string, value: any) => void;
  onUpdateSchema: (fn: (prev: SchemaContextType) => SchemaContextType) => void;
}) {
  return (
    <>
      <TextField
        label="Roles (comma-separated)"
        value={Array.isArray(schema.roles) ? schema.roles.join(", ") : String(schema.roles ?? "")}
        onChange={(e) =>
          onChange(
            "roles",
            e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
        fullWidth
        size="small"
        sx={{ mb: 3 }}
      />
      <MappingEditor
        label="Role Mapping"
        mapping={schema.roleMapping ?? {}}
        onChange={(v) => onUpdateSchema((prev) => ({ ...prev, roleMapping: v }))}
      />
      <Box sx={{ my: 2 }} />
      <MappingEditor
        label="Program Mapping"
        mapping={schema.programMapping ?? {}}
        onChange={(v) => onUpdateSchema((prev) => ({ ...prev, programMapping: v }))}
      />
      <Box sx={{ my: 2 }} />
      <MappingEditor
        label="School Mapping"
        mapping={schema.schoolMapping ?? {}}
        onChange={(v) => onUpdateSchema((prev) => ({ ...prev, schoolMapping: v }))}
      />
    </>
  );
}

// ─── Section: Calendar Config ───
function CalendarConfigSection({
  schema,
  onChange,
}: {
  schema: SchemaContextType;
  onChange: (path: string, value: any) => void;
}) {
  const config = schema.calendarConfig;
  if (!config) return <Typography variant="body2">No calendar config</Typography>;

  return (
    <>
      {config.startHour && (
        <Box mb={2}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Start Hour
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={1}>
            {Object.entries(config.startHour).map(([role, val]) => (
              <TextField
                key={role}
                label={role}
                value={val ?? ""}
                onChange={(e) =>
                  onChange(`calendarConfig.startHour.${role}`, e.target.value)
                }
                size="small"
                sx={{ width: 180 }}
              />
            ))}
          </Box>
        </Box>
      )}
      {config.slotUnit && (
        <Box mb={2}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Slot Unit (minutes)
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={1}>
            {Object.entries(config.slotUnit).map(([role, val]) => (
              <TextField
                key={role}
                label={role}
                type="number"
                value={val ?? 15}
                onChange={(e) =>
                  onChange(
                    `calendarConfig.slotUnit.${role}`,
                    Number(e.target.value),
                  )
                }
                size="small"
                sx={{ width: 160 }}
              />
            ))}
          </Box>
        </Box>
      )}
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Time Sensitive Request Warning
        </Typography>
        <Box display="flex" gap={2} flexWrap="wrap">
          <FormControlLabel
            control={
              <Switch
                checked={
                  schema.timeSensitiveRequestWarning?.isActive ?? false
                }
                onChange={(e) =>
                  onChange(
                    "timeSensitiveRequestWarning.isActive",
                    e.target.checked,
                  )
                }
                size="small"
              />
            }
            label="Active"
          />
          <TextField
            label="Hours"
            type="number"
            value={schema.timeSensitiveRequestWarning?.hours ?? 48}
            onChange={(e) =>
              onChange(
                "timeSensitiveRequestWarning.hours",
                Number(e.target.value),
              )
            }
            size="small"
            sx={{ width: 120 }}
          />
          <TextField
            label="Message"
            value={schema.timeSensitiveRequestWarning?.message ?? ""}
            onChange={(e) =>
              onChange("timeSensitiveRequestWarning.message", e.target.value)
            }
            size="small"
            sx={{ flex: 1, minWidth: 200 }}
          />
          <TextField
            label="Policy Link"
            value={schema.timeSensitiveRequestWarning?.policyLink ?? ""}
            onChange={(e) =>
              onChange(
                "timeSensitiveRequestWarning.policyLink",
                e.target.value,
              )
            }
            size="small"
            sx={{ flex: 1, minWidth: 200 }}
          />
        </Box>
      </Box>
    </>
  );
}

// ─── Unconfigured Fields Banner ───
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
  const [mode, setMode] = useState<EditorMode>("form");
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

  const handleFieldChange = (path: string, value: any) => {
    setSchema((prev) => {
      if (!prev) return prev;
      return setNestedValue(prev, path, value);
    });
  };

  const handleUpdateSchema = (
    fn: (prev: SchemaContextType) => SchemaContextType,
  ) => {
    setSchema((prev) => (prev ? fn(prev) : prev));
  };

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
          "x-user-email": userEmail,
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

  const sections = [
    { id: "basic", label: "Basic Info", content: schema && <BasicInfoSection schema={schema} onChange={handleFieldChange} /> },
    { id: "toggles", label: "Feature Toggles", content: schema && <FeatureTogglesSection schema={schema} onChange={handleFieldChange} /> },
    { id: "policy", label: "Policy", content: schema && <PolicySection schema={schema} onChange={handleFieldChange} /> },
    { id: "resources", label: `Resources (${schema?.resources?.length ?? 0})`, content: schema && <ResourcesSection schema={schema} onUpdateSchema={handleUpdateSchema} /> },
    { id: "agreements", label: `Agreements (${schema?.agreements?.length ?? 0})`, content: schema && <AgreementsSection schema={schema} onUpdateSchema={handleUpdateSchema} /> },
    { id: "mappings", label: "Roles & Mappings", content: schema && <MappingsSection schema={schema} onChange={handleFieldChange} onUpdateSchema={handleUpdateSchema} /> },
    { id: "calendar", label: "Calendar Config", content: schema && <CalendarConfigSection schema={schema} onChange={handleFieldChange} /> },
    { id: "email", label: "Email Messages", content: schema && <EmailMessagesSection schema={schema} onChange={handleFieldChange} /> },
  ];

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

        {tenant && (
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={(_, v) => { if (v) setMode(v); }}
            size="small"
          >
            <ToggleButton value="form">Form</ToggleButton>
            <ToggleButton value="json">JSON</ToggleButton>
          </ToggleButtonGroup>
        )}

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

      {schema && !loading && mode === "form" && (
        <Box>
          {sections.map((section) => (
            <Accordion key={section.id}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>{section.label}</Typography>
              </AccordionSummary>
              <AccordionDetails>{section.content}</AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      {schema && !loading && mode === "json" && (
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
