import { Alert, Box, Button, TextField } from "@mui/material";
import React, { useState } from "react";
import { clientAddBookingNote } from "../../../bookingActionClient";
import { MAX_ACTION_NOTE_LENGTH } from "../../../../utils/bookingHistoryNotes";

interface Props {
  calendarEventId: string;
  tenant: string;
  /** Called after the note is saved, so the history can reload. */
  onAdded: () => void;
}

/**
 * Lets staff add a note to a booking's history without changing its status.
 * Notes are visible to the requester, like the rest of the history.
 */
export default function AddHistoryNote({
  calendarEventId,
  tenant,
  onAdded,
}: Props) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setNote("");
    setError(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await clientAddBookingNote(calendarEventId, note.trim(), tenant);
      close();
      onAdded();
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Failed to add note",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button size="small" onClick={() => setOpen(true)} sx={{ mt: 1 }}>
        Add note
      </Button>
    );
  }

  return (
    <Box sx={{ mt: 1 }}>
      <TextField
        label="Note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        multiline
        minRows={2}
        fullWidth
        autoFocus
        disabled={saving}
        inputProps={{ maxLength: MAX_ACTION_NOTE_LENGTH }}
      />
      <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
        <Button
          variant="contained"
          size="small"
          onClick={save}
          disabled={saving || !note.trim()}
        >
          {saving ? "Saving..." : "Save note"}
        </Button>
        <Button size="small" onClick={close} disabled={saving}>
          Cancel
        </Button>
      </Box>
      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
}
