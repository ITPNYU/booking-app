import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { useState } from "react";

import AlertToast from "../../components/AlertToast";

const SyncCalendars = () => {
  const [loading, setLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertSeverity, setAlertSeverity] = useState<"error" | "success">(
    "success"
  );
  const [message, setMessage] = useState("");

  // Dry-run state
  const [showDryRunDialog, setShowDryRunDialog] = useState(false);
  const [dryRunData, setDryRunData] = useState<any>(null);

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

  const handlePregameDryRun = async () => {
    setLoading(true);
    setShowAlert(false);
    try {
      const response = await fetch(
        "/api/syncSemesterPregameBookings?dryRun=true",
        {
          method: "POST",
        }
      );
      const data = await response.json();
      if (response.ok) {
        setDryRunData(data);
        setShowDryRunDialog(true);
      } else {
        setMessage(`Error: ${data.error}`);
        setAlertSeverity("error");
        setShowAlert(true);
      }
    } catch (error) {
      setMessage("An error occurred while running dry-run.");
      setAlertSeverity("error");
      setShowAlert(true);
    } finally {
      setLoading(false);
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
        <Box sx={{ marginTop: 2, display: "flex", gap: 2 }}>
          <Button
            onClick={handlePregameDryRun}
            variant="outlined"
            disabled={loading}
            color="info"
          >
            DRY RUN PREGAME SYNC
          </Button>
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

      {/* Dry Run Results Dialog */}
      <Dialog
        open={showDryRunDialog}
        onClose={() => setShowDryRunDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Dry Run Results - Pregame Calendar Sync</DialogTitle>
        <DialogContent>
          {dryRunData && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                {dryRunData.message}
              </Typography>

              {/* Summary */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Summary:
                </Typography>
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                  <Chip
                    label={`Total Bookings: ${dryRunData.results?.length || 0}`}
                    color="primary"
                  />
                </Box>
              </Box>

              {/* Results Display */}
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  Booking Objects:
                </Typography>
                <Box sx={{ maxHeight: 400, overflow: "auto" }}>
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      fontSize: "12px",
                      fontFamily: "monospace",
                      backgroundColor: "#f5f5f5",
                      padding: "16px",
                      borderRadius: "4px",
                    }}
                  >
                    {JSON.stringify(dryRunData.results, null, 2)}
                  </pre>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDryRunDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SyncCalendars;
