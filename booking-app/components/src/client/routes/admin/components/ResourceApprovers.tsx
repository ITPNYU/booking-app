import {
  CheckCircleOutline,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useContext, useEffect, useRef, useState } from "react";

import {
  clientAddResourceRoomToApprover,
  clientGetAllApproversWithRooms,
  clientRemoveResourceRoomFromApprover,
} from "@/lib/firebase/firebase";
import { SchemaContext } from "../../components/SchemaProvider";

type ApproverRow = {
  id: string;
  email: string;
  resourceRoomIds: number[];
  /** roomId being toggled right now, if any */
  togglingRoomId: number | null;
};

export const ResourceApprovers = () => {
  const { resources, tenant } = useContext(SchemaContext);

  const [rows, setRows] = useState<ApproverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (successTimerRef.current !== null)
        clearTimeout(successTimerRef.current);
    },
    [],
  );

  const loadApprovers = useCallback(async () => {
    setLoading(true);
    setGlobalError(null);
    try {
      const data = await clientGetAllApproversWithRooms(tenant);
      setRows(
        data.map((a) => ({
          id: a.id,
          email: a.email,
          resourceRoomIds: a.resourceRoomIds,
          togglingRoomId: null,
        })),
      );
    } catch {
      setGlobalError("Failed to load approvers. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    loadApprovers();
  }, [loadApprovers]);

  const handleToggleRoom = async (approverDocId: string, roomId: number) => {
    const row = rows.find((r) => r.id === approverDocId);
    if (!row || row.togglingRoomId !== null) return;

    const isAssigned = row.resourceRoomIds.includes(roomId);

    setRows((prev) =>
      prev.map((r) =>
        r.id === approverDocId ? { ...r, togglingRoomId: roomId } : r,
      ),
    );

    try {
      if (isAssigned) {
        await clientRemoveResourceRoomFromApprover(approverDocId, roomId, tenant);
      } else {
        await clientAddResourceRoomToApprover(approverDocId, roomId, tenant);
      }

      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== approverDocId) return r;
          const updated = isAssigned
            ? r.resourceRoomIds.filter((id) => id !== roomId)
            : [...r.resourceRoomIds, roomId];
          return { ...r, resourceRoomIds: updated, togglingRoomId: null };
        }),
      );

      setSavedId(approverDocId);
      if (successTimerRef.current !== null) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => {
        setSavedId((prev) => (prev === approverDocId ? null : prev));
        successTimerRef.current = null;
      }, 2000);
    } catch {
      setRows((prev) =>
        prev.map((r) =>
          r.id === approverDocId ? { ...r, togglingRoomId: null } : r,
        ),
      );
      setGlobalError(
        `Failed to update room assignment for "${row.email}". Please try again.`,
      );
    }
  };

  if (loading) {
    return (
      <Box display="flex" alignItems="center" gap={1} mt={2}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">
          Loading approvers...
        </Typography>
      </Box>
    );
  }

  if (rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" mt={2}>
        No approver users found in this tenant.
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
              <TableCell sx={{ fontWeight: 600 }}>Approver</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>
                Resource Rooms (click to toggle)
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2">{row.email}</Typography>
                    {savedId === row.id && (
                      <CheckCircleOutline
                        fontSize="small"
                        sx={{ color: "success.main" }}
                      />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                    {resources.map((r) => {
                      const assigned = row.resourceRoomIds.includes(r.roomId);
                      const toggling = row.togglingRoomId === r.roomId;
                      return (
                        <Tooltip
                          key={r.roomId}
                          title={
                            assigned
                              ? `Remove resource approver access for "${r.name}"`
                              : `Grant resource approver access for "${r.name}"`
                          }
                        >
                          <span>
                            <Chip
                              label={
                                toggling ? (
                                  <Box
                                    display="flex"
                                    alignItems="center"
                                    gap={0.5}
                                  >
                                    <CircularProgress
                                      size={10}
                                      color="inherit"
                                    />
                                    {r.name}
                                  </Box>
                                ) : (
                                  r.name
                                )
                              }
                              size="small"
                              color={assigned ? "primary" : "default"}
                              variant={assigned ? "filled" : "outlined"}
                              onClick={() =>
                                handleToggleRoom(row.id, r.roomId)
                              }
                              disabled={row.togglingRoomId !== null}
                              sx={{ cursor: "pointer" }}
                            />
                          </span>
                        </Tooltip>
                      );
                    })}
                    {resources.length === 0 && (
                      <Typography variant="body2" color="text.disabled">
                        <em>No resources in tenant schema</em>
                      </Typography>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
