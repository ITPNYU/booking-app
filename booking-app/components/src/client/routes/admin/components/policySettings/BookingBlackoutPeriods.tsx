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
  Radio,
  RadioGroup,
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
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { Timestamp } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";

import {
  EVENT_ROOMS,
  MULTI_ROOMS,
  PRODUCTION_ROOMS,
} from "@/components/src/mediaCommonsPolicy";
import { TableNames } from "@/components/src/policy";
import { BlackoutPeriod } from "@/components/src/types";
import {
  clientDeleteDataFromFirestore,
  clientFetchAllDataFromCollection,
  clientSaveDataToFirestore,
  clientUpdateDataInFirestore,
} from "@/lib/firebase/firebase";
import dayjs, { Dayjs } from "dayjs";
import { DatabaseContext } from "../../../components/Provider";

type RoomApplicationType =
  | "all"
  | "production"
  | "event"
  | "multi"
  | "specific";

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
  const [roomApplicationType, setRoomApplicationType] =
    useState<RoomApplicationType>("all");

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
        // Check what type of room application this is
        const allRoomIds = roomSettings
          .map((room) => room.roomId)
          .sort((a, b) => a - b);
        const periodRoomIds = [...period.roomIds].sort((a, b) => a - b);
        const productionRoomIds = PRODUCTION_ROOMS.filter((roomId) =>
          roomSettings.some((room) => room.roomId === roomId)
        ).sort((a, b) => a - b);
        const eventRoomIds = EVENT_ROOMS.filter((roomId) =>
          roomSettings.some((room) => room.roomId === roomId)
        ).sort((a, b) => a - b);
        const multiRoomIds = MULTI_ROOMS.filter((roomId) =>
          roomSettings.some((room) => room.roomId === roomId)
        ).sort((a, b) => a - b);

        const isAllRooms =
          allRoomIds.length === periodRoomIds.length &&
          allRoomIds.every((id, index) => id === periodRoomIds[index]);
        const isProductionRooms =
          productionRoomIds.length === periodRoomIds.length &&
          productionRoomIds.every((id, index) => id === periodRoomIds[index]);
        const isEventRooms =
          eventRoomIds.length === periodRoomIds.length &&
          eventRoomIds.every((id, index) => id === periodRoomIds[index]);
        const isMultiRooms =
          multiRoomIds.length === periodRoomIds.length &&
          multiRoomIds.every((id, index) => id === periodRoomIds[index]);

        if (isAllRooms) {
          setSelectedRooms([]);
          setRoomApplicationType("all");
        } else if (isProductionRooms) {
          setSelectedRooms([]);
          setRoomApplicationType("production");
        } else if (isEventRooms) {
          setSelectedRooms([]);
          setRoomApplicationType("event");
        } else if (isMultiRooms) {
          setSelectedRooms([]);
          setRoomApplicationType("multi");
        } else {
          setSelectedRooms(period.roomIds);
          setRoomApplicationType("specific");
        }
      } else {
        setSelectedRooms([]);
        setRoomApplicationType("all");
      }
    } else {
      setEditingPeriod(null);
      setPeriodName("");
      setStartDate(null);
      setEndDate(null);
      setSelectedRooms([]);
      setRoomApplicationType("all");
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPeriod(null);
    setSelectedRooms([]);
    setRoomApplicationType("all");
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

    if (roomApplicationType === "specific" && selectedRooms.length === 0) {
      setMessage({
        type: "error",
        text: "Please select at least one room or choose a different room application type.",
      });
      return;
    }

    // Check if roomSettings is available when applying to room categories
    if (
      roomApplicationType !== "specific" &&
      (!roomSettings || roomSettings.length === 0)
    ) {
      setMessage({
        type: "error",
        text: "Room settings not loaded. Please refresh the page and try again.",
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      let allRoomIds: number[] = [];

      switch (roomApplicationType) {
        case "all":
          allRoomIds = roomSettings.map((room) => room.roomId);
          break;
        case "production":
          allRoomIds = PRODUCTION_ROOMS.filter((roomId) =>
            roomSettings.some((room) => room.roomId === roomId)
          );
          break;
        case "event":
          allRoomIds = EVENT_ROOMS.filter((roomId) =>
            roomSettings.some((room) => room.roomId === roomId)
          );
          break;
        case "multi":
          allRoomIds = MULTI_ROOMS.filter((roomId) =>
            roomSettings.some((room) => room.roomId === roomId)
          );
          break;
        case "specific":
          allRoomIds = selectedRooms;
          break;
      }

      console.log("Saving blackout period:", {
        roomApplicationType,
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

    // Check if this matches any of our predefined categories
    const allRoomIds = roomSettings
      .map((room) => room.roomId)
      .sort((a, b) => a - b);
    const periodRoomIds = [...period.roomIds].sort((a, b) => a - b);
    const productionRoomIds = PRODUCTION_ROOMS.filter((roomId) =>
      roomSettings.some((room) => room.roomId === roomId)
    ).sort((a, b) => a - b);
    const eventRoomIds = EVENT_ROOMS.filter((roomId) =>
      roomSettings.some((room) => room.roomId === roomId)
    ).sort((a, b) => a - b);
    const multiRoomIds = MULTI_ROOMS.filter((roomId) =>
      roomSettings.some((room) => room.roomId === roomId)
    ).sort((a, b) => a - b);

    const isAllRooms =
      allRoomIds.length === periodRoomIds.length &&
      allRoomIds.every((id, index) => id === periodRoomIds[index]);
    const isProductionRooms =
      productionRoomIds.length === periodRoomIds.length &&
      productionRoomIds.every((id, index) => id === periodRoomIds[index]);
    const isEventRooms =
      eventRoomIds.length === periodRoomIds.length &&
      eventRoomIds.every((id, index) => id === periodRoomIds[index]);
    const isMultiRooms =
      multiRoomIds.length === periodRoomIds.length &&
      multiRoomIds.every((id, index) => id === periodRoomIds[index]);

    if (isAllRooms) {
      return "All Rooms";
    } else if (isProductionRooms) {
      return `Production Rooms (${productionRoomIds.join(", ")})`;
    } else if (isEventRooms) {
      return `Event Rooms (${eventRoomIds.join(", ")})`;
    } else if (isMultiRooms) {
      return `Multi-Room (${multiRoomIds.join(", ")})`;
    } else {
      const selectedRoomNames = period.roomIds
        .map((roomId) => {
          const room = roomSettings.find((r) => r.roomId === roomId);
          return room ? `${room.roomId} - ${room.name}` : `Room ${roomId}`;
        })
        .join(", ");
      return selectedRoomNames || "Unknown Rooms";
    }
  };

  const getProductionRoomNumbers = () => {
    return PRODUCTION_ROOMS.filter((roomId) =>
      roomSettings.some((room) => room.roomId === roomId)
    ).join(", ");
  };

  const getEventRoomNumbers = () => {
    return EVENT_ROOMS.filter((roomId) =>
      roomSettings.some((room) => room.roomId === roomId)
    ).join(", ");
  };

  const getMultiRoomNumbers = () => {
    return MULTI_ROOMS.filter((roomId) =>
      roomSettings.some((room) => room.roomId === roomId)
    ).join(", ");
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

              <FormControl>
                <Typography variant="subtitle2" gutterBottom>
                  Apply to:
                </Typography>
                <RadioGroup
                  value={roomApplicationType}
                  onChange={(e) => {
                    setRoomApplicationType(
                      e.target.value as RoomApplicationType
                    );
                    if (e.target.value !== "specific") {
                      setSelectedRooms([]);
                    }
                  }}
                >
                  <FormControlLabel
                    value="all"
                    control={<Radio />}
                    label={`All Rooms (${roomSettings?.length || 0} rooms)`}
                  />
                  <FormControlLabel
                    value="production"
                    control={<Radio />}
                    label={`Production Rooms (${getProductionRoomNumbers()})`}
                  />
                  <FormControlLabel
                    value="event"
                    control={<Radio />}
                    label={`Event Rooms (${getEventRoomNumbers()})`}
                  />
                  <FormControlLabel
                    value="multi"
                    control={<Radio />}
                    label={`Multi-Room (${getMultiRoomNumbers()})`}
                  />
                  <FormControlLabel
                    value="specific"
                    control={<Radio />}
                    label={`Specific Rooms (${selectedRooms.length} rooms)`}
                  />
                </RadioGroup>
              </FormControl>

              {roomApplicationType === "specific" && (
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
