"use client";

import {
  Box,
  Button,
  FormControlLabel,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useContext, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DatabaseContext } from "../../components/Provider";

export default function SiteBannerSettings() {
  const { siteBanner, reloadAdminUsers } = useContext(DatabaseContext);
  const params = useParams<{ tenant: string }>();
  const tenant =
    typeof params?.tenant === "string" ? params.tenant : undefined;

  const [enabled, setEnabled] = useState(siteBanner.enabled);
  const [message, setMessage] = useState(siteBanner.message);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(siteBanner.enabled);
    setMessage(siteBanner.message);
  }, [siteBanner.enabled, siteBanner.message]);

  const handleSave = async () => {
    if (!tenant) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/tenant-site-banner", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant,
          siteBanner: { enabled, message },
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `Save failed (${res.status})`);
      }
      await reloadAdminUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6">Site banner</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        Show a short message at the top of this tenant for all signed-in
        users. Plain text only.
      </Typography>

      <FormControlLabel
        sx={{ mt: 2 }}
        control={
          <Switch
            checked={enabled}
            onChange={(_, v) => setEnabled(v)}
            color="primary"
          />
        }
        label="Banner visible"
      />

      <TextField
        label="Message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        multiline
        minRows={4}
        fullWidth
        sx={{ mt: 2 }}
        inputProps={{ maxLength: 4000 }}
        disabled={saving}
      />

      <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 2 }}>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {error && (
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
