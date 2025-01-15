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
      <Typography variant="h6"> Import Manual Calendar Events</Typography>
      <p>
        This function imports existing manually entered events from Production
        Google Calendars to the Booking Tool database.
      </p>
      <Box sx={{ marginTop: 2 }}>
        <Button onClick={handleSync} variant="contained" disabled={loading}>
          IMPORT MANUAL CALENDAR EVENTS
        </Button>
      </Box>
      <AlertToast
        message={message}
        severity={alertSeverity}
        open={showAlert}
        handleClose={() => setShowAlert(false)}
      />
      <Box sx={{ marginTop: 4 }}>
        <Typography variant="h6"> Import Pregame Calendar Events</Typography>
        <p>
          This function imports existing pregame events from Production Google
          Calendars to the Booking Tool database.
        </p>
        <Box sx={{ marginTop: 2 }}>
          <Button
            onClick={handlePregameSync}
            variant="contained"
            disabled={loading}
          >
            IMPORT PREGAME CALENDAR EVENTS
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
