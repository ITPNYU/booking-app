import {
  Alert,
  AlertTitle,
  Backdrop,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import { useState } from "react";

import AlertToast from "../../components/AlertToast";
import { TIMEZONE } from "../../../utils/date";

const formatFirestoreTimestamp = (value: any): string => {
  if (!value) return "";
  const seconds = value.seconds ?? value._seconds;
  if (typeof seconds !== "number") return String(value);
  const date = new Date(seconds * 1000);
  return date.toLocaleString("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const servicesSummary = (booking: any): string[] => {
  const requested: string[] = [];
  if (booking?.equipmentServices) requested.push("Equipment");
  if (booking?.staffingServices) requested.push("Staff");
  if (booking?.catering === "yes") requested.push("Catering");
  if (booking?.cleaning === "yes") requested.push("Cleaning");
  if (booking?.hireSecurity === "yes") requested.push("Security");
  if (booking?.roomSetup === "yes") requested.push("Setup");
  return requested;
};

const DryRunRow = ({ booking, index }: { booking: any; index: number }) => {
  const [open, setOpen] = useState(false);
  const services = servicesSummary(booking);
  const issues: string[] = Array.isArray(booking?._issues) ? booking._issues : [];
  const hasIssues = issues.length > 0;
  return (
    <>
      <TableRow
        hover
        sx={
          hasIssues
            ? {
                bgcolor: "#fff8e1",
                borderLeft: "3px solid #d32f2f",
              }
            : undefined
        }
      >
        <TableCell sx={{ width: 40, pr: 0 }}>
          <IconButton
            size="small"
            aria-label={open ? "Collapse booking details" : "Expand booking details"}
            aria-expanded={open}
            onClick={() => setOpen(v => !v)}
          >
            {open ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ width: 48 }}>{index + 1}</TableCell>
        <TableCell sx={{ width: 90 }}>
          {booking?.requestNumber ? booking.requestNumber : "—"}
        </TableCell>
        <TableCell sx={{ minWidth: 260 }}>{booking?.title || "—"}</TableCell>
        <TableCell sx={{ whiteSpace: "nowrap" }}>
          {formatFirestoreTimestamp(booking?.startDate)}
        </TableCell>
        <TableCell sx={{ whiteSpace: "nowrap" }}>
          {formatFirestoreTimestamp(booking?.endDate)}
        </TableCell>
        <TableCell>{booking?.roomId || "—"}</TableCell>
        <TableCell sx={{ whiteSpace: "nowrap" }}>
          {booking?.email || "—"}
        </TableCell>
        <TableCell>
          {services.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              none
            </Typography>
          ) : (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {services.map(s => (
                <Chip key={s} label={s} size="small" variant="outlined" />
              ))}
            </Stack>
          )}
        </TableCell>
        <TableCell sx={{ minWidth: 160 }}>
          {hasIssues ? (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {issues.map(issue => (
                <Chip
                  key={issue}
                  label={issue}
                  size="small"
                  color="error"
                  variant="filled"
                />
              ))}
            </Stack>
          ) : (
            <Chip label="OK" size="small" color="success" variant="outlined" />
          )}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={10} sx={{ p: 0, borderBottom: open ? undefined : "none" }}>
          <Collapse in={open} unmountOnExit>
            <Box
              sx={{
                bgcolor: "#fafafa",
                p: 2,
                borderLeft: "3px solid #1976d2",
                m: 1,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Raw booking object
              </Typography>
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontSize: 11,
                  fontFamily: "monospace",
                }}
              >
                {JSON.stringify(booking, null, 2)}
              </pre>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

const IS_PRODUCTION_DEPLOY =
  process.env.NEXT_PUBLIC_BRANCH_NAME === "production";

type LoadingAction =
  | null
  | "manualSync"
  | "pregameDryRun"
  | "pregameTest"
  | "pregameSync";

const loadingLabel: Record<Exclude<LoadingAction, null>, string> = {
  manualSync: "Importing manual calendar events…",
  pregameDryRun: "Running pregame dry-run…",
  pregameTest: "Running pregame test import…",
  pregameSync: "Importing pregame calendar events…",
};

const SyncCalendars = () => {
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
  const loading = loadingAction !== null;
  const [showAlert, setShowAlert] = useState(false);
  const [alertSeverity, setAlertSeverity] = useState<"error" | "success">(
    "success",
  );
  const [message, setMessage] = useState("");

  // Dry-run state
  const [showDryRunDialog, setShowDryRunDialog] = useState(false);
  const [dryRunData, setDryRunData] = useState<any>(null);

  const handleSync = async () => {
    setLoadingAction("manualSync");
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
      setLoadingAction(null);
      setShowAlert(true);
    }
  };

  const handlePregameSync = async () => {
    setLoadingAction("pregameSync");
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
      setLoadingAction(null);
      setShowAlert(true);
    }
  };

  const handlePregameDryRun = async () => {
    setLoadingAction("pregameDryRun");
    setShowAlert(false);
    try {
      // On non-prod deploys, pregame events only exist on production
      // calendars. Opt into testMode so the dry-run reads prod calendars
      // (read-only) instead of the empty dev/staging calendars.
      const params = IS_PRODUCTION_DEPLOY
        ? "dryRun=true"
        : "dryRun=true&testMode=true";
      const response = await fetch(
        `/api/syncSemesterPregameBookings?${params}`,
        {
          method: "POST",
        },
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
      setLoadingAction(null);
    }
  };

  const handlePregameTestImport = async () => {
    const confirmed = window.confirm(
      "TEST IMPORT (DEV): this reads production calendars but writes to the current environment's Firestore, overrides guest emails to booking-app+pregame@itp.nyu.edu, and does NOT modify calendar event titles. Continue?",
    );
    if (!confirmed) return;
    setLoadingAction("pregameTest");
    setShowAlert(false);
    try {
      const response = await fetch(
        "/api/syncSemesterPregameBookings?testMode=true",
        { method: "POST" },
      );
      const data = await response.json();
      if (response.ok) {
        setMessage(`Test import complete: ${data.message}`);
        setAlertSeverity("success");
      } else {
        setMessage(`Error: ${data.error}`);
        setAlertSeverity("error");
      }
    } catch (error) {
      setMessage("An error occurred while running the test import.");
      setAlertSeverity("error");
    } finally {
      setLoadingAction(null);
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
        <Button
          onClick={handleSync}
          variant="contained"
          disabled={loading}
          startIcon={
            loadingAction === "manualSync" ? (
              <CircularProgress size={16} color="inherit" />
            ) : undefined
          }
        >
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

        {!IS_PRODUCTION_DEPLOY ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            <AlertTitle>Dev / Staging mode</AlertTitle>
            Pregame events only exist on production Google Calendars, so both
            buttons below opt into <strong>testMode</strong>:
            <ul style={{ marginTop: 4, marginBottom: 0, paddingLeft: 20 }}>
              <li>
                <strong>DRY RUN</strong>: previews what a real import would
                create. Reads production calendars (read-only). No Firestore
                writes, no calendar changes.
              </li>
              <li>
                <strong>TEST IMPORT</strong>: reads production calendars and
                writes booking records to <em>this environment&apos;s</em>
                &nbsp;Firestore. Guest emails are overridden to&nbsp;
                <code>booking-app+pregame@itp.nyu.edu</code> so real requesters
                never receive invites. Production calendar event titles are
                NOT modified.
              </li>
            </ul>
            The real <code>IMPORT PREGAME CALENDAR EVENTS</code> button is
            only available on the production deployment.
          </Alert>
        ) : (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <AlertTitle>Production</AlertTitle>
            <strong>DRY RUN</strong> previews the import without writing.&nbsp;
            <strong>IMPORT PREGAME CALENDAR EVENTS</strong> performs the real
            import: creates <code>mc-bookings</code> records, adds&nbsp;
            <code>[PRE-APPROVED]</code> prefix to calendar event titles, and
            keeps real requester emails on each booking.
          </Alert>
        )}

        <Box sx={{ marginTop: 2, display: "flex", gap: 2, flexWrap: "wrap" }}>
          <Button
            onClick={handlePregameDryRun}
            variant="outlined"
            disabled={loading}
            color="info"
            startIcon={
              loadingAction === "pregameDryRun" ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
          >
            DRY RUN PREGAME SYNC
          </Button>
          {!IS_PRODUCTION_DEPLOY && (
            <Button
              onClick={handlePregameTestImport}
              variant="outlined"
              disabled={loading}
              color="warning"
              startIcon={
                loadingAction === "pregameTest" ? (
                  <CircularProgress size={16} color="inherit" />
                ) : undefined
              }
            >
              TEST IMPORT (DEV)
            </Button>
          )}
          {IS_PRODUCTION_DEPLOY && (
            <Button
              onClick={handlePregameSync}
              variant="contained"
              disabled={loading}
              startIcon={
                loadingAction === "pregameSync" ? (
                  <CircularProgress size={16} color="inherit" />
                ) : undefined
              }
            >
              IMPORT PREGAME CALENDAR EVENTS
            </Button>
          )}
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
              <Typography variant="body2" sx={{ mb: 2 }}>
                {dryRunData.message}
              </Typography>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
                {dryRunData.testMode && (
                  <Chip label="TEST MODE" color="warning" size="small" />
                )}
                <Chip
                  label={`New: ${dryRunData.summary?.newBookings ?? 0}`}
                  color="success"
                  size="small"
                />
                <Chip
                  label={`Existing: ${dryRunData.summary?.existingBookings ?? 0}`}
                  color="warning"
                  size="small"
                />
                {(dryRunData.summary?.issuesCount ?? 0) > 0 && (
                  <Chip
                    label={`Issues: ${dryRunData.summary.issuesCount}`}
                    color="error"
                    size="small"
                  />
                )}
                <Chip
                  label={`Total payload rows: ${dryRunData.summary?.totalEvents ?? 0}`}
                  color="primary"
                  size="small"
                  variant="outlined"
                />
              </Stack>

              {Array.isArray(dryRunData.results) && dryRunData.results.length > 0 ? (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell />
                        <TableCell>#</TableCell>
                        <TableCell>Request&nbsp;#</TableCell>
                        <TableCell>Title</TableCell>
                        <TableCell>Start (NY)</TableCell>
                        <TableCell>End (NY)</TableCell>
                        <TableCell>Room(s)</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Services</TableCell>
                        <TableCell>Issues</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {[...dryRunData.results]
                        .sort((a: any, b: any) => {
                          const aIssues = Array.isArray(a?._issues)
                            ? a._issues.length
                            : 0;
                          const bIssues = Array.isArray(b?._issues)
                            ? b._issues.length
                            : 0;
                          return bIssues - aIssues;
                        })
                        .map((booking: any, i: number) => (
                          <DryRunRow
                            key={booking?.calendarEventId || i}
                            booking={booking}
                            index={i}
                          />
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No new bookings would be created. (Existing or skipped events do
                  not appear in this list.)
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDryRunDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Backdrop
        open={loading}
        sx={{
          zIndex: theme => theme.zIndex.modal + 1,
          color: "#fff",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <CircularProgress color="inherit" />
        <Typography variant="body1">
          {loadingAction ? loadingLabel[loadingAction] : "Working…"}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          This can take a minute. Please don&apos;t close the tab.
        </Typography>
      </Backdrop>
    </Box>
  );
};

export default SyncCalendars;
