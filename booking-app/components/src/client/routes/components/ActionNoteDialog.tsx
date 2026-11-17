import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from "@mui/material";
import React, { cloneElement, useState } from "react";
import { MAX_ACTION_NOTE_LENGTH } from "../../../utils/bookingHistoryNotes";

interface Props {
  title: string;
  message: string;
  /** Declines need a reason; every other action's note is optional. */
  required?: boolean;
  value: string;
  setValue: (x: string) => void;
  callback: (result: boolean) => void;
  children: React.ReactElement<{ onClick?: React.MouseEventHandler }>;
}

/**
 * Confirms a booking action and collects the note recorded with it in the
 * booking history. The trigger is the child component.
 */
export default function ActionNoteDialog({
  title,
  message,
  required = false,
  callback,
  value,
  setValue,
  children,
}: Props) {
  const [open, setOpen] = useState(false);

  const trigger = cloneElement(children, {
    onClick: () => setOpen(true),
  });

  const handleClose = (result: boolean) => {
    setOpen(false);
    if (result) callback(result);
  };

  const missingRequiredNote = required && (!value || value.trim().length === 0);

  return (
    <>
      {trigger}
      <Dialog
        open={open}
        onClose={() => handleClose(false)}
        aria-labelledby="action-note-dialog-title"
        aria-describedby="action-note-dialog-description"
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle id="action-note-dialog-title">{title}</DialogTitle>
        <DialogContent>
          <DialogContentText id="action-note-dialog-description">
            {message}
          </DialogContentText>
          <TextField
            value={value ?? ""}
            onChange={(e) => setValue(e.target.value)}
            label={required ? "Reason" : "Note (optional)"}
            required={required}
            multiline
            minRows={2}
            inputProps={{ maxLength: MAX_ACTION_NOTE_LENGTH }}
            sx={{ marginTop: 2 }}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleClose(false)}>Cancel</Button>
          <Button
            onClick={() => handleClose(true)}
            autoFocus
            disabled={missingRequiredNote}
          >
            Ok
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
