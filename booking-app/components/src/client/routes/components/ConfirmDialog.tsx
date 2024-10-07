import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import React, { cloneElement, useState } from 'react';

interface Props {
  message: string;
  title?: string;
  callback: (result: boolean) => void;
  children: React.ReactElement;
}

/**
 * This confirmation dialog wraps around child components and controls its own state.
 * The trigger is the child component.
 */
export default function ConfirmDialog(props: Props) {
  const { message, title, callback, children } = props;
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
        {title != null && (
          <DialogTitle id="alert-dialog-title">{title}</DialogTitle>
        )}
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            {message}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleClose(false)}>Cancel</Button>
          <Button onClick={() => handleClose(true)} autoFocus>
            Ok
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

interface PropsControlled {
  title: string;
  message: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Control this confirmation dialog with external state and an external trigger.
 */
export function ConfirmDialogControlled({
  open,
  onClose,
  title,
  message,
}: PropsControlled) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      {title != null && (
        <DialogTitle id="alert-dialog-title">{title}</DialogTitle>
      )}
      <DialogContent>
        <DialogContentText id="alert-dialog-description">
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} autoFocus>
          Ok
        </Button>
      </DialogActions>
    </Dialog>
  );
}
