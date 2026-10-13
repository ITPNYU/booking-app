"use client";

import type { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";
import type { Resource } from "@/components/src/client/routes/components/schemaTypes";
import {
  resourceFromDefault,
  resourceIdError,
  TEMPLATE_SCHEMA_ID,
  type ResourceFormFields,
} from "@/lib/tenant/resourceDefault";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

type FormState = {
  name: string;
  resourceId: string;
  capacity: string;
  calendarId: string;
  calendarIdProd: string;
  isEquipment: boolean;
  isWalkIn: boolean;
};

const emptyForm: FormState = {
  name: "",
  resourceId: "",
  capacity: "0",
  calendarId: "",
  calendarIdProd: "",
  isEquipment: false,
  isWalkIn: false,
};

function formFromResource(resource: Resource): FormState {
  return {
    name: resource.name ?? "",
    resourceId: resource.resourceId ?? "",
    capacity: String(resource.capacity ?? 0),
    calendarId: resource.calendarId ?? "",
    calendarIdProd: resource.calendarIdProd ?? "",
    isEquipment: Boolean(resource.isEquipment),
    isWalkIn: Boolean(resource.isWalkIn),
  };
}

function resourceLabel(resource: Resource): string {
  return `${resource.name || "(unnamed)"} · ${resource.resourceId} · capacity ${resource.capacity}`;
}

type FormMode = "closed" | "edit" | "add";

export async function initializeResourceDefault(): Promise<void> {
  const res = await fetch(`/api/tenantSchema/${TEMPLATE_SCHEMA_ID}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "initialize-resource-default" }),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(result.error || `Failed: ${res.status}`);
  }
}

async function fetchResourceDefault(): Promise<Resource | null> {
  const res = await fetch(`/api/tenantSchema/${TEMPLATE_SCHEMA_ID}?raw=1`);
  if (res.status === 404) return null;
  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(result.error || `Failed: ${res.status}`);
  }
  const resourceDefault = result.resourceDefault;
  if (
    !resourceDefault ||
    typeof resourceDefault !== "object" ||
    Array.isArray(resourceDefault)
  ) {
    return null;
  }
  return resourceDefault as Resource;
}

export default function SchemaResourceForm({
  schema,
  onSchemaChange,
}: {
  schema: SchemaContextType;
  onSchemaChange: (schema: SchemaContextType) => void;
}) {
  const [mode, setMode] = useState<FormMode>("closed");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [resourceDefault, setResourceDefault] = useState<Resource | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<
    "loading" | "ready" | "missing" | "error"
  >("loading");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);

  const loadDefault = async (): Promise<Resource | null> => {
    setDefaultStatus("loading");
    setStatusError(null);
    try {
      const stored = await fetchResourceDefault();
      setResourceDefault(stored);
      setDefaultStatus(stored ? "ready" : "missing");
      return stored;
    } catch (err: unknown) {
      setResourceDefault(null);
      setDefaultStatus("error");
      setStatusError(err instanceof Error ? err.message : "Failed to load resource default");
      return null;
    }
  };

  useEffect(() => {
    void loadDefault();
  }, []);

  const resources = Array.isArray(schema.resources) ? schema.resources : [];
  const selected =
    selectedIndex !== null ? resources[selectedIndex] : undefined;

  useEffect(() => {
    if (selectedIndex !== null && selectedIndex >= resources.length) {
      setSelectedIndex(null);
      setMode("closed");
    }
  }, [resources.length, selectedIndex]);

  const openAdd = () => {
    setFormError(null);
    setSelectedIndex(null);
    setForm(resourceDefault ? formFromResource(resourceDefault) : emptyForm);
    setMode("add");
  };

  const selectResource = (index: number) => {
    const resource = resources[index];
    if (!resource) return;
    setFormError(null);
    setSelectedIndex(index);
    setForm(formFromResource(resource));
    setMode("edit");
  };

  const closeForm = () => {
    setMode("closed");
    setSelectedIndex(null);
    setFormError(null);
  };

  const handleInitialize = async () => {
    setInitializing(true);
    setStatusError(null);
    try {
      await initializeResourceDefault();
      const stored = await loadDefault();
      if (stored) setForm(formFromResource(stored));
    } catch (err: unknown) {
      setStatusError(
        err instanceof Error ? err.message : "Failed to initialize resource default",
      );
    } finally {
      setInitializing(false);
    }
  };

  const readFields = (): ResourceFormFields | null => {
    const otherIds = resources
      .filter((_, index) => mode !== "edit" || index !== selectedIndex)
      .map((resource) => String(resource.resourceId ?? ""));
    const idError = resourceIdError(form.resourceId, otherIds);
    if (idError) {
      setFormError(idError);
      return null;
    }
    const capacity = Number(form.capacity);
    if (form.capacity.trim() === "" || !Number.isFinite(capacity)) {
      setFormError("Capacity must be a number");
      return null;
    }
    return {
      name: form.name,
      resourceId: form.resourceId,
      capacity,
      calendarId: form.calendarId,
      calendarIdProd: form.calendarIdProd,
      isEquipment: form.isEquipment,
      isWalkIn: form.isWalkIn,
    };
  };

  const handleAdd = () => {
    if (!resourceDefault) return;
    const fields = readFields();
    if (!fields) return;
    const nextResources = [
      ...resources,
      resourceFromDefault(resourceDefault, fields),
    ];
    onSchemaChange({ ...schema, resources: nextResources });
    setSelectedIndex(nextResources.length - 1);
    setMode("edit");
    setFormError(null);
  };

  const handleUpdate = () => {
    if (!selected || selectedIndex === null) return;
    const fields = readFields();
    if (!fields) return;
    const nextResources = resources.map((resource, index) =>
      index === selectedIndex
        ? resourceFromDefault(resource, fields)
        : resource,
    );
    onSchemaChange({ ...schema, resources: nextResources });
    setFormError(null);
  };

  const handleDelete = () => {
    if (selectedIndex === null) return;
    onSchemaChange({
      ...schema,
      resources: resources.filter((_, index) => index !== selectedIndex),
    });
    setSelectedIndex(null);
    setMode("closed");
    setFormError(null);
  };

  const showFields =
    (mode === "edit" && Boolean(selected)) ||
    (mode === "add" && defaultStatus === "ready" && Boolean(resourceDefault));

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle1" gutterBottom>
        Resources
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Choose a resource to edit or delete it, or add one. This updates the
        schema JSON on this page. Save to write it to the database.
      </Typography>
      <Box display="flex" gap={1} alignItems="center" flexWrap="wrap" mb={1}>
        <FormControl sx={{ minWidth: 360 }} disabled={resources.length === 0}>
          <InputLabel id="schema-resource-select">Resource</InputLabel>
          <Select
            labelId="schema-resource-select"
            label="Resource"
            value={selectedIndex === null ? "" : String(selectedIndex)}
            onChange={(event) => {
              const value = String(event.target.value);
              if (value === "") {
                closeForm();
                return;
              }
              selectResource(Number(value));
            }}
          >
            <MenuItem value="" sx={{ display: "none" }} />
            {resources.map((resource, index) => (
              <MenuItem key={`${resource.resourceId}-${index}`} value={String(index)}>
                {resourceLabel(resource)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="outlined"
          color="error"
          onClick={handleDelete}
          disabled={selectedIndex === null}
        >
          Delete
        </Button>
        <Button
          variant="outlined"
          onClick={openAdd}
          disabled={defaultStatus === "loading" || mode === "add"}
        >
          Add resource
        </Button>
      </Box>

      {mode === "add" && (
        <Box sx={{ maxWidth: 480, mt: 1 }}>
          {defaultStatus === "loading" && (
            <Typography variant="body2">Loading resource default...</Typography>
          )}
          {statusError && <Alert severity="error">{statusError}</Alert>}
          {defaultStatus === "missing" && (
            <Alert
              severity="info"
              sx={{ mb: 1 }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={handleInitialize}
                  disabled={initializing}
                >
                  Initialize resource default
                </Button>
              }
            >
              No resource default is stored in the database yet.
            </Alert>
          )}
        </Box>
      )}

      {showFields && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            maxWidth: 480,
            mt: 1,
          }}
        >
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            label="Name"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
          />
          <TextField
            label="Resource id"
            value={form.resourceId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                resourceId: event.target.value,
              }))
            }
          />
          <TextField
            label="Capacity"
            type="number"
            value={form.capacity}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                capacity: event.target.value,
              }))
            }
          />
          <TextField
            label="Calendar id"
            value={form.calendarId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                calendarId: event.target.value,
              }))
            }
          />
          <TextField
            label="Production calendar id"
            value={form.calendarIdProd}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                calendarIdProd: event.target.value,
              }))
            }
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={form.isEquipment}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    isEquipment: event.target.checked,
                  }))
                }
              />
            }
            label="Equipment"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={form.isWalkIn}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    isWalkIn: event.target.checked,
                  }))
                }
              />
            }
            label="Walk-in"
          />
          <Box display="flex" gap={1}>
            {mode === "add" ? (
              <Button variant="contained" onClick={handleAdd}>
                Add to schema
              </Button>
            ) : (
              <Button variant="contained" onClick={handleUpdate}>
                Update resource
              </Button>
            )}
            <Button variant="outlined" onClick={closeForm}>
              Cancel
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
