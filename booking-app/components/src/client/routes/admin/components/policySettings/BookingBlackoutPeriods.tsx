import { TableNames } from "@/components/src/policy";
import { BlackoutPeriod } from "@/components/src/types";
import {
  clientDeleteDataFromFirestore,
  clientFetchAllDataFromCollection,
  clientSaveDataToFirestore,
  clientUpdateDataInFirestore,
} from "@/lib/firebase/firebase";
import { Add, Delete, Edit } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import dayjs, { Dayjs } from "dayjs";
import { Timestamp } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";
import { DatabaseContext } from "../../../components/Provider";

export default function BookingBlackoutPeriods() {
  const { roomSettings } = useContext(DatabaseContext);
  const [blackoutPeriods, setBlackoutPeriods] = useState<BlackoutPeriod[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<BlackoutPeriod | null>(
    null
  );

  // Form state
  const [periodName, setPeriodName] = useState("");
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [selectedRooms, setSelectedRooms] = useState<number[]>([]);
  const [applyToAllRooms, setApplyToAllRooms] = useState(true);

  useEffect(() => {
    fetchBlackoutPeriods();
  }, []);

  useEffect(() => {
    console.log("Room settings updated:", {
      roomSettings: roomSettings?.length || 0,
      rooms: roomSettings?.map((r) => ({ id: r.roomId, name: r.name })) || [],
    });
  }, [roomSettings]);

  const fetchBlackoutPeriods = async () => {
    try {
      const fetchedData =
        await clientFetchAllDataFromCollection<BlackoutPeriod>(
          TableNames.BLACKOUT_PERIODS
        );
      setBlackoutPeriods(
        fetchedData.sort(
          (a, b) =>
            a.startDate.toDate().getTime() - b.startDate.toDate().getTime()
        )
      );
    } catch (error) {
      console.error("Error fetching blackout periods:", error);
    }
  };

  const handleOpenDialog = (period?: BlackoutPeriod) => {
    if (period) {
      setEditingPeriod(period);
      setPeriodName(period.name);
      setStartDate(dayjs(period.startDate.toDate()));
      setEndDate(dayjs(period.endDate.toDate()));

      if (period.roomIds && period.roomIds.length > 0) {
        // Check if all available rooms are included
        const allRoomIds = roomSettings
          .map((room) => room.roomId)
          .sort((a, b) => a - b);
        const periodRoomIds = [...period.roomIds].sort((a, b) => a - b);
        const isAllRooms =
          allRoomIds.length === periodRoomIds.length &&
          allRoomIds.every((id, index) => id === periodRoomIds[index]);

        if (isAllRooms) {
          setSelectedRooms([]);
          setApplyToAllRooms(true);
        } else {
          setSelectedRooms(period.roomIds);
          setApplyToAllRooms(false);
        }
      } else {
        setSelectedRooms([]);
        setApplyToAllRooms(true);
      }
    } else {
      setEditingPeriod(null);
      setPeriodName("");
      setStartDate(null);
      setEndDate(null);
      setSelectedRooms([]);
      setApplyToAllRooms(true);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPeriod(null);
    setSelectedRooms([]);
    setApplyToAllRooms(true);
    setMessage(null);
  };

  const handleSavePeriod = async () => {
    if (!periodName.trim() || !startDate || !endDate) {
      setMessage({
        type: "error",
        text: "Please fill in all fields: name, start date, and end date.",
      });
      return;
    }

    if (endDate.isBefore(startDate)) {
      setMessage({ type: "error", text: "End date must be after start date." });
      return;
    }

    if (!applyToAllRooms && selectedRooms.length === 0) {
      setMessage({
        type: "error",
        text: "Please select at least one room or choose 'Apply to all rooms'.",
      });
      return;
    }

    // Check if roomSettings is available when applying to all rooms
    if (applyToAllRooms && (!roomSettings || roomSettings.length === 0)) {
      setMessage({
        type: "error",
        text: "Room settings not loaded. Please refresh the page and try again.",
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const allRoomIds = applyToAllRooms
        ? roomSettings.map((room) => room.roomId)
        : selectedRooms;

      console.log("Saving blackout period:", {
        applyToAllRooms,
        roomSettings: roomSettings?.length || 0,
        allRoomIds,
        selectedRooms,
      });

      const periodData = {
        name: periodName.trim(),
        startDate: Timestamp.fromDate(startDate.toDate()),
        endDate: Timestamp.fromDate(endDate.toDate()),
        isActive: true, // Always active when created/updated
        updatedAt: Timestamp.now(),
        roomIds: allRoomIds,
      };

      console.log("Period data to save:", periodData);

      if (editingPeriod) {
        await clientUpdateDataInFirestore(
          TableNames.BLACKOUT_PERIODS,
          editingPeriod.id!,
          periodData
        );
        setMessage({
          type: "success",
          text: "Blackout period updated successfully!",
        });
      } else {
        await clientSaveDataToFirestore(TableNames.BLACKOUT_PERIODS, {
          ...periodData,
          createdAt: Timestamp.now(),
        });
        setMessage({
          type: "success",
          text: "Blackout period added successfully!",
        });
      }

      await fetchBlackoutPeriods();
      handleCloseDialog();
    } catch (error) {
      console.error("Error saving blackout period:", error);
      setMessage({ type: "error", text: "Failed to save. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePeriod = async (period: BlackoutPeriod) => {
    if (!window.confirm(`Are you sure you want to delete "${period.name}"?`)) {
      return;
    }

    setLoading(true);
    try {
      await clientDeleteDataFromFirestore(
        TableNames.BLACKOUT_PERIODS,
        period.id!
      );
      await fetchBlackoutPeriods();
      setMessage({
        type: "success",
        text: "Blackout period deleted successfully!",
      });
    } catch (error) {
      console.error("Error deleting blackout period:", error);
      setMessage({
        type: "error",
        text: "Failed to delete. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: Timestamp) => {
    return dayjs(timestamp.toDate()).format("MMMM D, YYYY");
  };

  const getRoomNames = (period: BlackoutPeriod) => {
    if (!period.roomIds || period.roomIds.length === 0) {
      return "All Rooms";
    }

    // Check if all available rooms are included
    const allRoomIds = roomSettings
      .map((room) => room.roomId)
      .sort((a, b) => a - b);
    const periodRoomIds = [...period.roomIds].sort((a, b) => a - b);
    const isAllRooms =
      allRoomIds.length === periodRoomIds.length &&
      allRoomIds.every((id, index) => id === periodRoomIds[index]);

    if (isAllRooms) {
      return "All Rooms";
    }

    const selectedRoomNames = period.roomIds
      .map((roomId) => {
        const room = roomSettings.find((r) => r.roomId === roomId);
        return room ? `${room.roomId} - ${room.name}` : `Room ${roomId}`;
      })
      .join(", ");
    return selectedRoomNames || "Unknown Rooms";
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 3,
          }}
        >
          <div>
            <Typography variant="h6" gutterBottom>
              Booking Blackout Periods
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Configure periods when bookings are not allowed (e.g., holidays,
              maintenance, summer break)
            </Typography>
          </div>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
            disabled={loading}
          >
            Add Period
          </Button>
        </Box>

        {message && (
          <Alert severity={message.type} sx={{ mb: 3 }}>
            {message.text}
          </Alert>
        )}

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Period Name</TableCell>
                <TableCell>Start Date</TableCell>
                <TableCell>End Date</TableCell>
                <TableCell>Applied Rooms</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {blackoutPeriods.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No blackout periods configured
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                blackoutPeriods.map((period) => (
                  <TableRow key={period.id}>
                    <TableCell>{period.name}</TableCell>
                    <TableCell>{formatDate(period.startDate)}</TableCell>
                    <TableCell>{formatDate(period.endDate)}</TableCell>
                    <TableCell>{getRoomNames(period)}</TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(period)}
                        disabled={loading}
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeletePeriod(period)}
                        disabled={loading}
                      >
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Dialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {editingPeriod ? "Edit Blackout Period" : "Add Blackout Period"}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField
                label="Period Name"
                value={periodName}
                onChange={(e) => setPeriodName(e.target.value)}
                fullWidth
                placeholder="e.g., Summer Break, Winter Holidays, Maintenance"
              />

              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={(newValue) => setStartDate(newValue)}
                slotProps={{
                  textField: { fullWidth: true },
                }}
              />

              <DatePicker
                label="End Date"
                value={endDate}
                onChange={(newValue) => setEndDate(newValue)}
                minDate={startDate || undefined}
                slotProps={{
                  textField: { fullWidth: true },
                }}
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={applyToAllRooms}
                    onChange={(e) => {
                      setApplyToAllRooms(e.target.checked);
                      if (e.target.checked) {
                        setSelectedRooms([]);
                      }
                    }}
                  />
                }
                label={`Apply to all rooms ${roomSettings?.length ? `(${roomSettings.length} rooms)` : "(loading...)"}`}
              />

              {!applyToAllRooms && (
                <FormControl fullWidth>
                  <InputLabel>Select Rooms</InputLabel>
                  <Select
                    multiple
                    value={selectedRooms}
                    onChange={(e) => {
                      const value = e.target.value as number[];
                      setSelectedRooms(value);
                    }}
                    input={<OutlinedInput label="Select Rooms" />}
                    renderValue={(selected) => (
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {selected.map((value) => {
                          const room = roomSettings.find(
                            (r) => r.roomId === value
                          );
                          return (
                            <Chip
                              key={value}
                              label={
                                room
                                  ? `${room.roomId} - ${room.name}`
                                  : `Room ${value}`
                              }
                              size="small"
                            />
                          );
                        })}
                      </Box>
                    )}
                  >
                    {roomSettings.map((room) => (
                      <MenuItem key={room.roomId} value={room.roomId}>
                        <Checkbox
                          checked={selectedRooms.indexOf(room.roomId) > -1}
                        />
                        <ListItemText
                          primary={`${room.roomId} - ${room.name}`}
                        />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {message && <Alert severity={message.type}>{message.text}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={handleSavePeriod}
              variant="contained"
              disabled={loading}
            >
              {loading ? "Saving..." : "Save"}
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </LocalizationProvider>
  );
}
