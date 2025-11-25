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

interface Props {
  value: string;
  setValue: (x: string) => void;
  callback: (result: boolean) => void;
  children: React.ReactElement;
}

export default function DeclineReasonDialog({
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

  return (
    <>
      {trigger}
      <Dialog
        open={open}
        onClose={() => handleClose(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure? This action can't be undone. This will be counted as a
            Late Cancelation if canceled less than 24 hours before the
            reservation start time.
          </DialogContentText>
          <DialogContentText id="alert-dialog-description">
            Please give a reason for declining this request.
          </DialogContentText>
          <TextField
            value={value}
            onChange={(e) => setValue(e.target.value)}
            sx={{ marginTop: 2 }}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleClose(false)}>Cancel</Button>
          <Button
            onClick={() => handleClose(true)}
            autoFocus
            disabled={!value || value.trim().length === 0}
          >
            Ok
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
