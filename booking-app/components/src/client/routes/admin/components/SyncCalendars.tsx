import { Box, Button, Typography } from "@mui/material";
import { useState } from "react";

import AlertToast from "../../components/AlertToast";

const SyncCalendars = () => {
  const [loading, setLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertSeverity, setAlertSeverity] = useState<"error" | "success">(
    "success"
  );
  const [message, setMessage] = useState("");

  const handleSync = async () => {
    setLoading(true);
    setShowAlert(false);
    try {
      const response = await fetch("/api/syncCalendars", { method: "POST" });
      const data = await response.json();
      if (response.ok) {
        setMessage(`Sync successful: ${data.message}`);
        setAlertSeverity("success");
      } else {
        setMessage(`Error: ${data.error}`);
        setAlertSeverity("error");
      }
    } catch (error) {
      setMessage("An error occurred while syncing calendars.");
      setAlertSeverity("error");
    } finally {
      setLoading(false);
      setShowAlert(true);
    }
  };
  const handlePregameSync = async () => {
    setLoading(true);
    setShowAlert(false);
    try {
      const response = await fetch("/api/syncSemesterPregameBookings", {
        method: "POST",
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(`Sync successful: ${data.message}`);
        setAlertSeverity("success");
      } else {
        setMessage(`Error: ${data.error}`);
        setAlertSeverity("error");
      }
    } catch (error) {
      setMessage("An error occurred while syncing calendars.");
      setAlertSeverity("error");
    } finally {
      setLoading(false);
      setShowAlert(true);
    }
  };

  return (
    <Box>
      <Typography variant="h6">
        {" "}
        Sync Current Semester Calendar Events
      </Typography>
      <p>
        This function saves existing events from the current semester's calendar
        to the database.
      </p>
      <Box sx={{ marginTop: 2 }}>
        <Button onClick={handleSync} variant="contained" disabled={loading}>
          Sync Calendar Events
        </Button>
      </Box>
      <AlertToast
        message={message}
        severity={alertSeverity}
        open={showAlert}
        handleClose={() => setShowAlert(false)}
      />
      <Box sx={{ marginTop: 4 }}>
        <Typography variant="h6">
          {" "}
          Sync Pregame Calendar Events to Database
        </Typography>
        <p>
          This function saves existing pregame events from the calendar to the
          database.
        </p>
        <Box sx={{ marginTop: 2 }}>
          <Button
            onClick={handlePregameSync}
            variant="contained"
            disabled={loading}
          >
            Sync Pregame Events
          </Button>
        </Box>
        <AlertToast
          message={message}
          severity={alertSeverity}
          open={showAlert}
          handleClose={() => setShowAlert(false)}
        />
      </Box>
    </Box>
  );
};

export default SyncCalendars;
