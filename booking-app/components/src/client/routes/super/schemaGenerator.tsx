"use client";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  BookingProfile,
  SchemaContextType,
} from "../components/SchemaProvider";
import { coerceTenantSchema } from "@/lib/tenant/coerceTenantSchema";
import { applyTenantIdentity } from "@/lib/tenant/tenantIdentity";
import {
  TEMPLATE_SCHEMA_ID,
  isCreatableTenantSlug,
} from "@/lib/tenant/tenantSlug";

type SnackState = {
  open: boolean;
  message: string;
  severity: "success" | "error";
};

function parseDeptCodes(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((code) => code.trim())
    .filter(Boolean);
}

function typeCheckSchema(
  text: string,
  existingIds: string[],
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
  const tenantId = typeof schema.tenantId === "string" ? schema.tenantId : "";
  if (!isCreatableTenantSlug(tenantId)) {
    return { error: `Invalid tenant slug: ${tenantId || "(empty)"}` };
  }
  if (existingIds.includes(tenantId)) {
    return { error: `Tenant schema already exists: ${tenantId}` };
  }
  try {
    coerceTenantSchema(schema, tenantId);
  } catch (error) {
    return {
      error: `Invalid schema: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
  return { schema };
}

export default function SchemaGenerator({
  onCreated,
}: {
  onCreated?: (tenantId: string) => void;
} = {}) {
  const [template, setTemplate] = useState<SchemaContextType | null>(null);
  const [templateMissing, setTemplateMissing] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [existingIds, setExistingIds] = useState<string[]>([]);

  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [nameForPolicy, setNameForPolicy] = useState("");
  const [logo, setLogo] = useState("");
  const [resourceName, setResourceName] = useState("Room");
  const [bookingProfile, setBookingProfile] = useState<BookingProfile>("itp");
  const [accessMode, setAccessMode] = useState<"all" | "dept">("all");
  const [deptCodes, setDeptCodes] = useState("");

  const [jsonText, setJsonText] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<SnackState>({
    open: false,
    message: "",
    severity: "success",
  });

  const loadDirectory = useCallback(async () => {
    const res = await fetch("/api/tenantSchema");
    if (!res.ok) return;
    const data = await res.json();
    setExistingIds(Array.isArray(data.ids) ? data.ids : []);
  }, []);

  const loadTemplate = useCallback(async () => {
    setLoadingTemplate(true);
    try {
      const res = await fetch(`/api/tenantSchema/${TEMPLATE_SCHEMA_ID}?raw=1`);
      if (res.status === 404) {
        setTemplate(null);
        setTemplateMissing(true);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to load template: ${res.status}`);
      }
      const data = (await res.json()) as SchemaContextType;
      setTemplate(data);
      setTemplateMissing(false);
    } catch (error) {
      setSnack({
        open: true,
        message: error instanceof Error ? error.message : String(error),
        severity: "error",
      });
    } finally {
      setLoadingTemplate(false);
    }
  }, []);

  useEffect(() => {
    loadTemplate();
    loadDirectory().catch(() => {
      // The slug check still runs on the server if the directory fails to load.
    });
  }, [loadDirectory, loadTemplate]);

  const checked = useMemo(
    () => (jsonText.trim() ? typeCheckSchema(jsonText, existingIds) : null),
    [existingIds, jsonText],
  );

  const buildJson = () => {
    if (!template) return;
    const next = applyTenantIdentity(template, {
      tenantId: slug.trim(),
      name: name.trim(),
      nameForPolicy: nameForPolicy.trim(),
      logo: logo.trim(),
      resourceName: resourceName.trim(),
      bookingProfile,
      access: {
        allNyu: accessMode === "all",
        deptCodes: accessMode === "dept" ? parseDeptCodes(deptCodes) : [],
      },
    });
    setJsonText(JSON.stringify(next, null, 2));
  };

  const initializeTemplate = async () => {
    setInitializing(true);
    try {
      const res = await fetch("/api/tenantSchema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "initialize-template" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed: ${res.status}`);
      setSnack({
        open: true,
        message: "Template schema created from code defaults.",
        severity: "success",
      });
      await loadTemplate();
      await loadDirectory();
    } catch (error) {
      setSnack({
        open: true,
        message: error instanceof Error ? error.message : String(error),
        severity: "error",
      });
    } finally {
      setInitializing(false);
    }
  };

  const confirmCreate = async () => {
    if (!checked?.schema) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tenantSchema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checked.schema),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed: ${res.status}`);
      setConfirmOpen(false);
      setSnack({
        open: true,
        message: `Tenant "${data.tenantId}" created. It is available at /${data.tenantId}.`,
        severity: "success",
      });
      setExistingIds((ids) =>
        ids.includes(data.tenantId) ? ids : [...ids, data.tenantId],
      );
      onCreated?.(data.tenantId);
    } catch (error) {
      setSnack({
        open: true,
        message: error instanceof Error ? error.message : String(error),
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const summary = checked?.schema;
  const summaryName =
    summary &&
    typeof summary.tenant === "object" &&
    summary.tenant &&
    "name" in summary.tenant
      ? String((summary.tenant as { name?: string }).name || "")
      : "";
  const summaryProfile =
    summary?.bookingProfile === "mc" ? "Media Commons" : "ITP";
  const summaryAccess =
    summary &&
    typeof summary.access === "object" &&
    summary.access &&
    (summary.access as { allNyu?: boolean }).allNyu
      ? "All NYU users"
      : `Department codes: ${
          summary &&
          typeof summary.access === "object" &&
          summary.access &&
          Array.isArray((summary.access as { deptCodes?: string[] }).deptCodes)
            ? (summary.access as { deptCodes: string[] }).deptCodes.join(", ") ||
              "(none)"
            : "(none)"
        }`;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        New tenant
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Starts from the Firestore template, then asks for this tenant&apos;s
        identity. Review the JSON and confirm before anything is written.
      </Typography>

      {loadingTemplate && (
        <Box display="flex" alignItems="center" gap={1} my={2}>
          <CircularProgress size={20} />
          <Typography variant="body2">Loading template...</Typography>
        </Box>
      )}

      {templateMissing && !loadingTemplate && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={initializeTemplate}
              disabled={initializing}
            >
              {initializing ? "Creating..." : "Initialize template"}
            </Button>
          }
        >
          No template document exists at tenantSchema/_template. Initialize it
          from the code defaults, then edit those defaults in the Schema Editor.
        </Alert>
      )}

      {template && !loadingTemplate && (
        <>
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
              helperText="Lowercase letters, numbers, and hyphens. This becomes the URL."
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
            <TextField
              select
              label="Booking profile"
              value={bookingProfile}
              onChange={(event) =>
                setBookingProfile(event.target.value as BookingProfile)
              }
            >
              <MenuItem value="itp">ITP (one approval)</MenuItem>
              <MenuItem value="mc">
                Media Commons (two approvals and services)
              </MenuItem>
            </TextField>
          </Box>

          <FormControl sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              Who can access this tenant
            </Typography>
            <RadioGroup
              value={accessMode}
              onChange={(event) =>
                setAccessMode(event.target.value as "all" | "dept")
              }
            >
              <FormControlLabel
                value="all"
                control={<Radio />}
                label="All NYU users"
              />
              <FormControlLabel
                value="dept"
                control={<Radio />}
                label="Specific department codes"
              />
            </RadioGroup>
            {accessMode === "dept" && (
              <TextField
                label="Department codes"
                value={deptCodes}
                onChange={(event) => setDeptCodes(event.target.value)}
                helperText="Separate codes with commas or spaces."
                sx={{ mt: 1 }}
              />
            )}
          </FormControl>

          <Box mb={2}>
            <Button variant="outlined" onClick={buildJson} disabled={!slug.trim()}>
              Build JSON
            </Button>
          </Box>

          {checked?.error && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {checked.error}
            </Alert>
          )}

          <Box
            component="textarea"
            value={jsonText}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
              setJsonText(event.target.value)
            }
            spellCheck={false}
            placeholder="Build JSON from the form, then edit resources, calendars, emails, and mappings here."
            sx={{
              width: "100%",
              minHeight: 420,
              fontFamily: "monospace",
              fontSize: 13,
              lineHeight: 1.5,
              p: 1.5,
              border: checked?.error ? "2px solid #d32f2f" : "1px solid #ccc",
              borderRadius: 1,
              resize: "vertical",
            }}
          />

          <Box mt={2}>
            <Button
              variant="contained"
              disabled={!checked?.schema || saving}
              onClick={() => setConfirmOpen(true)}
            >
              Review and create
            </Button>
          </Box>
        </>
      )}

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create tenant schema</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" gutterBottom>
            This writes a new Firestore document. It does not update an existing
            tenant.
          </Typography>
          <Typography variant="body2">Slug: {String(summary?.tenantId || "")}</Typography>
          <Typography variant="body2">Name: {summaryName}</Typography>
          <Typography variant="body2">Booking profile: {summaryProfile}</Typography>
          <Typography variant="body2">Access: {summaryAccess}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={confirmCreate} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : "Create tenant"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={6000}
        onClose={() => setSnack((current) => ({ ...current, open: false }))}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack((current) => ({ ...current, open: false }))}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
