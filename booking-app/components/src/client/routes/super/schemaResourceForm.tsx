"use client";

import type { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";
import type { Resource } from "@/components/src/client/routes/components/schemaTypes";
import {
  mergeResource,
  plainResourceDefault,
  resourceIdError,
  TEMPLATE_SCHEMA_ID,
} from "@/lib/tenant/resourceDefault";
import SchemaResourceFields from "./schemaResourceFields";
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

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
  const [draft, setDraft] = useState<Resource | null>(null);
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

  const draftFrom = (source: Resource): Resource => {
    const base = resourceDefault
      ? mergeResource(plainResourceDefault(), resourceDefault)
      : plainResourceDefault();
    return mergeResource(base, source);
  };

  const openAdd = () => {
    setFormError(null);
    setSelectedIndex(null);
    if (resourceDefault) setDraft(draftFrom(resourceDefault));
    setMode("add");
  };

  const selectResource = (index: number) => {
    const resource = resources[index];
    if (!resource) return;
    setFormError(null);
    setSelectedIndex(index);
    setDraft(draftFrom(resource));
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
      if (stored) setDraft(mergeResource(plainResourceDefault(), stored));
    } catch (err: unknown) {
      setStatusError(
        err instanceof Error ? err.message : "Failed to initialize resource default",
      );
    } finally {
      setInitializing(false);
    }
  };

  const readResource = (): Resource | null => {
    if (!draft) return null;
    const otherIds = resources
      .filter((_, index) => mode !== "edit" || index !== selectedIndex)
      .map((resource) => String(resource.resourceId ?? ""));
    const idError = resourceIdError(draft.resourceId, otherIds);
    if (idError) {
      setFormError(idError);
      return null;
    }
    const capacity = Number(draft.capacity);
    if (!Number.isFinite(capacity)) {
      setFormError("Capacity must be a number");
      return null;
    }
    return { ...draft, resourceId: draft.resourceId.trim(), capacity };
  };

  const handleAdd = () => {
    if (!resourceDefault) return;
    const resource = readResource();
    if (!resource) return;
    const nextResources = [...resources, resource];
    onSchemaChange({ ...schema, resources: nextResources });
    setSelectedIndex(nextResources.length - 1);
    setMode("edit");
    setFormError(null);
  };

  const handleUpdate = () => {
    if (!selected || selectedIndex === null) return;
    const resource = readResource();
    if (!resource) return;
    const nextResources = resources.map((current, index) =>
      index === selectedIndex ? resource : current,
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
        Choose a resource to edit or delete it, or add one. Hours, limits,
        services, staffing, and training are in the form below. This updates
        the schema JSON on this page. Save to write it to the database.
      </Typography>
      <Box display="flex" gap={1} alignItems="center" flexWrap="wrap" mb={4}>
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
        <Box sx={{ maxWidth: 480, mt: 2 }}>
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
            gap: 1.5,
            mt: 2,
          }}
        >
          {formError && <Alert severity="error">{formError}</Alert>}
          {draft && (
            <SchemaResourceFields resource={draft} onChange={setDraft} />
          )}
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
