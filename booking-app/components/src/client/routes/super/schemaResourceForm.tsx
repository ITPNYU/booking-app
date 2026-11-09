"use client";

import type { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";
import type { Resource } from "@/components/src/client/routes/components/schemaTypes";
import {
  mergeResource,
  plainResource,
  plainResourceDefault,
  projectResourceEdits,
  resourceIdError,
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
import { alpha } from "@mui/material/styles";
import { useEffect, useRef, useState } from "react";

function resourceLabel(resource: Resource): string {
  return `${resource.name || "(unnamed)"} · ${resource.resourceId} · capacity ${resource.capacity}`;
}

type FormMode = "closed" | "edit" | "add";

export default function SchemaResourceForm({
  schema,
  onSchemaChange,
  beforeSchemaChange,
}: {
  schema: SchemaContextType;
  onSchemaChange: (schema: SchemaContextType) => void;
  /** Return false to keep the in-memory schema unchanged. */
  beforeSchemaChange?: () => boolean;
}) {
  const [mode, setMode] = useState<FormMode>("closed");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<Resource | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<Resource | null>(null);
  const [initialDraft, setInitialDraft] = useState<Resource | null>(null);
  const baselineJsonRef = useRef("");
  const seenTenantId = useRef(schema.tenantId);

  const resources = Array.isArray(schema.resources) ? schema.resources : [];
  const selected =
    selectedIndex !== null ? resources[selectedIndex] : undefined;

  useEffect(() => {
    if (selectedIndex !== null && selectedIndex >= resources.length) {
      setSelectedIndex(null);
      setMode("closed");
    }
  }, [resources.length, selectedIndex]);

  const draftFrom = (source: Resource): Resource =>
    mergeResource(plainResourceDefault(), source);

  const rememberResource = (source: Resource) => {
    const stored = plainResource(source);
    const next = draftFrom(source);
    baselineJsonRef.current = JSON.stringify(source);
    setBaseline(stored);
    setInitialDraft(next);
    setDraft(next);
  };

  const openAdd = () => {
    setFormError(null);
    setSelectedIndex(null);
    setBaseline(null);
    setInitialDraft(null);
    baselineJsonRef.current = "";
    setDraft(plainResourceDefault());
    setMode("add");
  };

  const selectResource = (index: number) => {
    const resource = resources[index];
    if (!resource) return;
    setFormError(null);
    setSelectedIndex(index);
    rememberResource(resource);
    setMode("edit");
  };

  const closeForm = () => {
    setMode("closed");
    setSelectedIndex(null);
    setDraft(null);
    setBaseline(null);
    setInitialDraft(null);
    baselineJsonRef.current = "";
    setFormError(null);
  };

  useEffect(() => {
    if (mode !== "edit" || !selected) return;
    if (schema.tenantId !== seenTenantId.current) return;
    const json = JSON.stringify(selected);
    if (json === baselineJsonRef.current) return;
    rememberResource(selected);
  }, [mode, selected, schema.tenantId]);

  useEffect(() => {
    seenTenantId.current = schema.tenantId;
    setSelectedIndex(null);
    setMode("closed");
    setDraft(null);
    setBaseline(null);
    setInitialDraft(null);
    baselineJsonRef.current = "";
    setFormError(null);
  }, [schema.tenantId]);

  const readResource = (): Resource | null => {
    if (!draft) return null;
    const otherIds = resources
      .filter((_, index) => mode !== "edit" || index !== selectedIndex)
      .map((resource) => String(resource.resourceId ?? "").trim());
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

  const commitSchema = (next: SchemaContextType): boolean => {
    if (beforeSchemaChange && !beforeSchemaChange()) return false;
    onSchemaChange(next);
    return true;
  };

  const handleAdd = () => {
    const resource = readResource();
    if (!resource) return;
    const nextResources = [...resources, resource];
    if (!commitSchema({ ...schema, resources: nextResources })) return;
    setSelectedIndex(nextResources.length - 1);
    setMode("edit");
    setFormError(null);
  };

  const handleUpdate = () => {
    if (!selected || selectedIndex === null || !baseline || !initialDraft) return;
    const resource = readResource();
    if (!resource) return;
    const edited = projectResourceEdits(baseline, initialDraft, resource);
    const nextResources = resources.map((current, index) =>
      index === selectedIndex ? edited : current,
    );
    if (!commitSchema({ ...schema, resources: nextResources })) return;
    setFormError(null);
  };

  const handleDelete = () => {
    if (selectedIndex === null) return;
    if (
      !commitSchema({
        ...schema,
        resources: resources.filter((_, index) => index !== selectedIndex),
      })
    ) {
      return;
    }
    setSelectedIndex(null);
    setMode("closed");
    setFormError(null);
  };

  const showFields =
    (mode === "edit" && Boolean(selected) && Boolean(draft)) ||
    (mode === "add" && Boolean(draft));

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
        <Button variant="outlined" onClick={openAdd} disabled={mode === "add"}>
          Add resource
        </Button>
      </Box>

      {showFields && (
        <Box
          sx={(theme) => {
            const tone =
              mode === "add" ? theme.palette.success.main : theme.palette.primary.main;
            return {
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
              mt: 2,
              p: 2,
              border: 2,
              borderRadius: 1,
              borderColor: tone,
              bgcolor: alpha(tone, 0.08),
            };
          }}
        >
          <Box>
            <Typography variant="subtitle1" component="h3">
              {mode === "add"
                ? "New resource"
                : `Editing ${selected?.name?.trim() || "(unnamed)"}`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {mode === "add"
                ? "Starts from the stored resource default. Nothing is written until you Save."
                : `Resource id ${selected?.resourceId?.trim() || "(no id)"}. Changes stay on this page until you Save.`}
            </Typography>
          </Box>
          {formError && <Alert severity="error">{formError}</Alert>}
          {draft && (
            <SchemaResourceFields resource={draft} onChange={setDraft} />
          )}
          <Box display="flex" gap={1}>
            {mode === "add" ? (
              <Button variant="contained" color="success" onClick={handleAdd}>
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
