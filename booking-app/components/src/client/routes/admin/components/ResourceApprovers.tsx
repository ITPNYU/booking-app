import {
  CheckCircleOutline,
  ClearOutlined,
  EditOutlined,
  SaveOutlined,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useContext, useEffect, useRef, useState } from "react";

import {
  clientClearResourceFinalApprover,
  clientGetResourceApprovers,
  clientSetResourceFinalApprover,
} from "@/lib/firebase/firebase";
import { SchemaContext } from "../../components/SchemaProvider";

type ResourceRow = {
  roomId: number;
  name: string;
  currentApprover: string;
  editValue: string;
  isEditing: boolean;
  isSaving: boolean;
};

export const ResourceApprovers = () => {
  const { resources, tenant } = useContext(SchemaContext);

  const [rows, setRows] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [savedRoomId, setSavedRoomId] = useState<number | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the success-indicator timer if the component unmounts before it fires.
  useEffect(
    () => () => {
      if (successTimerRef.current !== null)
        clearTimeout(successTimerRef.current);
    },
    [],
  );

  /** Load resource approvers from Firestore and merge with tenantSchema resources */
  const loadApprovers = useCallback(async () => {
    setLoading(true);
    setGlobalError(null);
    try {
      const data = await clientGetResourceApprovers(tenant);
      const resourceMap = data?.resources ?? {};

      setRows(
        resources.map((r) => {
          const approverEmail =
            resourceMap[String(r.roomId)]?.approvers?.finalApprover ?? "";
          return {
            roomId: r.roomId,
            name: r.name,
            currentApprover: approverEmail,
            editValue: approverEmail,
            isEditing: false,
            isSaving: false,
          };
        }),
      );
    } catch {
      setGlobalError("Failed to load resource approvers. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [resources, tenant]);

  useEffect(() => {
    loadApprovers();
  }, [loadApprovers]);

  const updateRow = (roomId: number, patch: Partial<ResourceRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.roomId === roomId ? { ...r, ...patch } : r)),
    );
  };

  const handleEdit = (roomId: number) => {
    setSavedRoomId(null);
    updateRow(roomId, { isEditing: true });
  };

  const handleCancel = (roomId: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.roomId === roomId
          ? { ...r, isEditing: false, editValue: r.currentApprover }
          : r,
      ),
    );
  };

  const handleSave = async (roomId: number) => {
    const row = rows.find((r) => r.roomId === roomId);
    if (!row) return;

    const trimmed = row.editValue.trim();
    updateRow(roomId, { isSaving: true });
    try {
      if (trimmed) {
        await clientSetResourceFinalApprover(roomId, trimmed, tenant);
      } else {
        // Clearing the approver — only call if there was a value before
        if (row.currentApprover) {
          await clientClearResourceFinalApprover(roomId, tenant);
        }
      }
      updateRow(roomId, {
        currentApprover: trimmed,
        editValue: trimmed,
        isEditing: false,
        isSaving: false,
      });
      setSavedRoomId(roomId);
      // Clear any prior timer, then hide success indicator after 2 s.
      // The ref is also cleared in the component's unmount effect.
      if (successTimerRef.current !== null) {
        clearTimeout(successTimerRef.current);
      }
      successTimerRef.current = setTimeout(() => {
        setSavedRoomId((prev) => (prev === roomId ? null : prev));
        successTimerRef.current = null;
      }, 2000);
    } catch {
      updateRow(roomId, { isSaving: false });
      setGlobalError(
        `Failed to save approver for "${row.name}". Please try again.`,
      );
    }
  };

  if (loading) {
    return (
      <Box display="flex" alignItems="center" gap={1} mt={2}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">
          Loading resource approvers…
        </Typography>
      </Box>
    );
  }

  if (rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" mt={2}>
        No resources found in the tenant schema.
      </Typography>
    );
  }

  return (
    <Box mt={1}>
      {globalError && (
        <Alert
          severity="error"
          onClose={() => setGlobalError(null)}
          sx={{ mb: 2 }}
        >
          {globalError}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Resource</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Room ID</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>
                Final Approver Email
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                Action
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.roomId} hover>
                <TableCell>{row.name}</TableCell>
                <TableCell>
                  <Chip label={row.roomId} size="small" variant="outlined" />
                </TableCell>
                <TableCell sx={{ minWidth: 280 }}>
                  {row.isEditing ? (
                    <TextField
                      size="small"
                      fullWidth
                      value={row.editValue}
                      placeholder="approver@example.com"
                      disabled={row.isSaving}
                      onChange={(e) =>
                        updateRow(row.roomId, { editValue: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSave(row.roomId);
                        if (e.key === "Escape") handleCancel(row.roomId);
                      }}
                      InputProps={{
                        endAdornment: row.isSaving ? (
                          <InputAdornment position="end">
                            <CircularProgress size={16} />
                          </InputAdornment>
                        ) : undefined,
                      }}
                      autoFocus
                    />
                  ) : (
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2">
                        {row.currentApprover || (
                          <em style={{ color: "rgba(0,0,0,0.4)" }}>
                            Not set – falls back to tenant default
                          </em>
                        )}
                      </Typography>
                      {savedRoomId === row.roomId && (
                        <CheckCircleOutline
                          fontSize="small"
                          sx={{ color: "success.main" }}
                        />
                      )}
                    </Box>
                  )}
                </TableCell>
                <TableCell align="right">
                  {row.isEditing ? (
                    <Box display="flex" gap={0.5} justifyContent="flex-end">
                      <Tooltip title="Save">
                        <span>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleSave(row.roomId)}
                            disabled={row.isSaving}
                          >
                            <SaveOutlined fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Cancel">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleCancel(row.roomId)}
                            disabled={row.isSaving}
                          >
                            <ClearOutlined fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  ) : (
                    <Tooltip title="Edit approver">
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(row.roomId)}
                      >
                        <EditOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
