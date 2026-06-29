"use client";

import {
  Box,
  Button,
  FormControlLabel,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useParams } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import {
  DEFAULT_MAINTENANCE_MODE_MESSAGE,
  MAINTENANCE_MODE_MESSAGE_MAX_LEN,
} from "@/lib/utils/maintenanceMode";
import { DatabaseContext } from "../../components/Provider";

export default function MaintenanceModeSettings() {
  const { maintenanceMode, reloadAdminUsers } = useContext(DatabaseContext);
  const params = useParams<{ tenant: string }>();
  const tenant = typeof params?.tenant === "string" ? params.tenant : undefined;

  const [enabled, setEnabled] = useState(maintenanceMode.enabled);
  const [message, setMessage] = useState(maintenanceMode.message);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(maintenanceMode.enabled);
    setMessage(maintenanceMode.message || DEFAULT_MAINTENANCE_MODE_MESSAGE);
  }, [maintenanceMode.enabled, maintenanceMode.message]);

  const handleSave = async () => {
    if (!tenant) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/tenant-maintenance-mode", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant,
          maintenanceMode: { enabled, message },
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
      <Typography variant="h6">Maintenance mode</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        Stop the public booking form from accepting new reservation requests.
      </Typography>

      <FormControlLabel
        sx={{ mt: 2 }}
        control={
          <Switch
            checked={enabled}
            onChange={(_, value) => setEnabled(value)}
            color="primary"
          />
        }
        label="Maintenance mode enabled"
      />

      <TextField
        label="Message"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        multiline
        minRows={4}
        fullWidth
        sx={{ mt: 2 }}
        inputProps={{ maxLength: MAINTENANCE_MODE_MESSAGE_MAX_LEN }}
        disabled={saving}
      />

      <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 2 }}>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
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
