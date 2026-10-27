"use client";

import { buildNewTenantSchema } from "@/lib/tenant/buildNewTenantSchema";
import { isCreatableTenantSlug } from "@/lib/tenant/tenantSlug";
import {
  formatSchemaIssues,
  validateTenantDocument,
} from "@/lib/tenant/validateTenantSchema";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";

function reviewedSchema(
  text: string,
): { schema?: Record<string, unknown>; error?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      error: `JSON parse error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: "Schema must be a JSON object" };
  }
  const schema = parsed as Record<string, unknown>;
  const tenantId = typeof schema.tenantId === "string" ? schema.tenantId.trim() : "";
  if (!isCreatableTenantSlug(tenantId)) {
    return { error: `Invalid tenant slug: ${tenantId || "(empty)"}` };
  }
  const tenant = schema.tenant;
  const name =
    tenant && typeof tenant === "object" && !Array.isArray(tenant)
      ? String((tenant as { name?: unknown }).name ?? "").trim()
      : "";
  if (!name) return { error: "Display name is required" };
  const checkedSchema = { ...schema, tenantId };
  const issues = validateTenantDocument(checkedSchema);
  if (issues.length > 0) {
    return { error: `Invalid schema: ${formatSchemaIssues(issues)}` };
  }
  return { schema: checkedSchema };
}

export default function SchemaCreateForm({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (tenantId: string) => void;
}) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [nameForPolicy, setNameForPolicy] = useState("");
  const [logo, setLogo] = useState("");
  const [resourceName, setResourceName] = useState("Room");
  const [jsonText, setJsonText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) return;
    setSlug("");
    setName("");
    setNameForPolicy("");
    setLogo("");
    setResourceName("Room");
    setJsonText("");
    setFormError(null);
    setConfirmOpen(false);
    setSaving(false);
  }, [open]);

  const checked = useMemo(
    () => (jsonText.trim() ? reviewedSchema(jsonText) : null),
    [jsonText],
  );
  const slugError =
    slug.trim() !== "" && !isCreatableTenantSlug(slug.trim())
      ? "Use a lowercase letter, then letters, numbers, or hyphens (up to 31 characters)."
      : "";

  const buildJson = () => {
    const tenantId = slug.trim();
    if (!isCreatableTenantSlug(tenantId) || !name.trim()) return;
    const next = buildNewTenantSchema({
      tenantId,
      name,
      nameForPolicy,
      logo,
      resourceName,
    });
    setJsonText(JSON.stringify(next, null, 2));
    setFormError(null);
  };

  const confirmCreate = async () => {
    if (!checked?.schema) return;
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/tenantSchema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checked.schema),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Failed: ${res.status}`);
      }
      const tenantId =
        typeof data.tenantId === "string" ? data.tenantId : checked.schema.tenantId;
      setConfirmOpen(false);
      onCreated(String(tenantId));
    } catch (error) {
      setConfirmOpen(false);
      setFormError(error instanceof Error ? error.message : "Failed to create tenant schema");
    } finally {
      setSaving(false);
    }
  };

  const summaryName =
    checked?.schema &&
    typeof checked.schema.tenant === "object" &&
    checked.schema.tenant &&
    "name" in checked.schema.tenant
      ? String((checked.schema.tenant as { name?: string }).name || "")
      : "";

  return (
    <>
      <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
        <DialogTitle>New tenant</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Starts from the code defaults with no rooms. Review the JSON and
            confirm before anything is written. This creates a schema document
            only. It does not open a booking site.
          </Typography>
          <Box
            display="grid"
            gridTemplateColumns={{ xs: "1fr", md: "1fr 1fr" }}
            gap={2}
            mb={2}
          >
            <TextField
              label="Slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              error={Boolean(slugError)}
              helperText={slugError || "Lowercase letters, numbers, and hyphens."}
              required
            />
            <TextField
              label="Display name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
            <TextField
              label="Name for policy"
              value={nameForPolicy}
              onChange={(event) => setNameForPolicy(event.target.value)}
            />
            <TextField
              label="Logo URL"
              value={logo}
              onChange={(event) => setLogo(event.target.value)}
            />
            <TextField
              label="Resource name"
              value={resourceName}
              onChange={(event) => setResourceName(event.target.value)}
              helperText='What a bookable space is called, for example "Room".'
            />
          </Box>
          <Button
            variant="outlined"
            onClick={buildJson}
            disabled={!isCreatableTenantSlug(slug.trim()) || !name.trim()}
            sx={{ mb: 2 }}
          >
            Review JSON
          </Button>
          {(formError || checked?.error) && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {formError || checked?.error}
            </Alert>
          )}
          <Box
            component="textarea"
            aria-label="New tenant JSON"
            value={jsonText}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
              setJsonText(event.target.value)
            }
            spellCheck={false}
            placeholder="Review JSON from the form, then edit it before creating the schema."
            sx={{
              width: "100%",
              minHeight: 280,
              fontFamily: "monospace",
              fontSize: 13,
              lineHeight: 1.5,
              p: 1.5,
              border: checked?.error ? "2px solid #d32f2f" : "1px solid #ccc",
              borderRadius: 1,
              resize: "vertical",
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!checked?.schema || saving}
            onClick={() => setConfirmOpen(true)}
          >
            Create tenant
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmOpen}
        onClose={saving ? undefined : () => setConfirmOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create tenant schema</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" gutterBottom>
            This writes a new Firestore document. It does not update an existing
            tenant, and the slug is not a booking site.
          </Typography>
          <Typography variant="body2">Slug: {String(checked?.schema?.tenantId || "")}</Typography>
          <Typography variant="body2">Name: {summaryName}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={confirmCreate} disabled={saving || !checked?.schema}>
            {saving ? <CircularProgress size={20} /> : "Create tenant schema"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
