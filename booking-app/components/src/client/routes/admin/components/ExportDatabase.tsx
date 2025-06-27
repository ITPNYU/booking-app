import { Box, Button, Typography } from "@mui/material";
import { useState } from "react";

import AlertToast from "../../components/AlertToast";

export default function ExportDatabase() {
  const [loading, setLoading] = useState(false);
  const [showError, setShowError] = useState(false);

  const onClick = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/bookings/export");

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(new Blob([blob]));

      // Generate filename with current date
      const currentDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
      const filename = `bookings_${currentDate}.csv`;

      // Automatically trigger the download
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();

      // Clean up
      window.URL.revokeObjectURL(url);
    } catch (ex) {
      setShowError(true);
      console.error("error exporting database", ex);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6">Export Database</Typography>
      <p>Export database booking contents as a downloadable CSV file</p>
      <Box sx={{ marginTop: 2 }}>
        <Button onClick={onClick} variant="contained" disabled={loading}>
          Export
        </Button>
      </Box>
      <AlertToast
        message="Failed to download file"
        severity="error"
        open={showError}
        handleClose={() => setShowError(false)}
      />
    </Box>
  );
}
