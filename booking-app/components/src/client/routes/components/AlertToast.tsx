import { Alert, AlertColor, Snackbar } from '@mui/material';

import React from 'react';

interface Props {
  open: boolean;
  handleClose: () => void;
  message: string;
  severity: AlertColor;
}

export default function AlertToast(props: Props) {
  const { open, handleClose, message, severity } = props;

  return (
    <Snackbar
      open={open}
      autoHideDuration={5000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert
        onClose={handleClose}
        severity={severity}
        variant="standard"
        sx={{ width: '100%' }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
}
