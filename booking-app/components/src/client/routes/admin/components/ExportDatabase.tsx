import { Box, Button, TextField, Typography } from "@mui/material";
import { useState } from "react";

import AlertToast from "../../components/AlertToast";

export default function ExportDatabase() {
  const [loading, setLoading] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const onClick = async () => {
    if (!startDate || !endDate || startDate > endDate) {
      setErrorMessage("Choose a valid start and end date before exporting.");
      setShowError(true);
      return;
    }

    setLoading(true);
    try {
      const query = new URLSearchParams({ startDate, endDate });
      const response = await fetch(`/api/bookings/export?${query}`);

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
      setErrorMessage("Failed to download file");
      setShowError(true);
      console.error("error exporting database", ex);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6">Export Database</Typography>
      <p>
        Export booking contents within an inclusive date range as a downloadable
        CSV file.
      </p>
      <Box
        sx={{ marginTop: 2, display: "flex", gap: 2, flexWrap: "wrap" }}
      >
        <TextField
          label="Start date"
          type="date"
          value={startDate}
          onChange={event => setStartDate(event.target.value)}
          InputLabelProps={{ shrink: true }}
          inputProps={{ max: endDate || undefined }}
          required
        />
        <TextField
          label="End date"
          type="date"
          value={endDate}
          onChange={event => setEndDate(event.target.value)}
          InputLabelProps={{ shrink: true }}
          inputProps={{ min: startDate || undefined }}
          required
        />
        <Button onClick={onClick} variant="contained" disabled={loading}>
          Export
        </Button>
      </Box>
      <AlertToast
        message={errorMessage}
        severity="error"
        open={showError}
        handleClose={() => setShowError(false)}
      />
    </Box>
  );
}
