import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Checkbox,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  TableSortLabel,
} from "@mui/material";
import { Info } from "@mui/icons-material";
import {
  clientDeleteDataFromFirestore,
  clientGetDataByCalendarEventId,
  clientUpdateDataInFirestore,
} from "@/lib/firebase/firebase";
import { DatabaseContext } from "../../components/Provider";
import { formatDate } from "../../../utils/date";
import { TableNames } from "../../../../policy";
import ListTable from "../../components/ListTable";
import { Booking } from "../../../../types";
import { useTenant } from "../../hooks/useTenant";
import {
  comparePreBanDetails,
  DetailSortColumn,
  PreBanDetails,
  preBanEventMillis,
} from "./preBanDetailsUtils";

interface DetailsByEmail {
  [email: string]: PreBanDetails[];
}

export const PreBannedUsers = () => {
  const { preBanLogs, reloadPreBanLogs } = useContext(DatabaseContext);
  const tenant = useTenant();
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [detailsByEmail, setDetailsByEmail] = useState<DetailsByEmail>({});
  const [rows, setRows] = useState<Array<{ [key: string]: string }>>([]);
  const [excuseSavingById, setExcuseSavingById] = useState<
    Record<string, boolean>
  >({});
  const [requestNumberByBookingId, setRequestNumberByBookingId] = useState<
    Record<string, number | undefined>
  >({});
  const [detailSortBy, setDetailSortBy] =
    useState<DetailSortColumn>("date");
  const [detailSortOrder, setDetailSortOrder] = useState<"asc" | "desc">(
    "desc",
  );

  useEffect(() => {
    reloadPreBanLogs();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const details: DetailsByEmail = {};
    const counts: { [email: string]: number } = {};

    preBanLogs.forEach((log) => {
      const email = `${log.netId}@nyu.edu`;
      if (!details[email]) {
        details[email] = [];
        counts[email] = 0;
      }
      details[email].push({
        date: log.lateCancelDate
          ? formatDate(log.lateCancelDate)
          : formatDate(log.noShowDate),
        eventTimeMs: preBanEventMillis(log),
        status: log.lateCancelDate ? "Late Cancel" : "No Show",
        id: log.id,
        bookingId: log.bookingId,
        excused: log.excused === true,
      });
      if (log.excused !== true) {
        counts[email]++;
      }
    });

    setDetailsByEmail(details);
    setRows(
      Object.entries(counts).map(([email, count]) => ({
        id: email,
        email,
        count: String(count),
        details: email,
      })),
    );

    // Reset stale request numbers before the new fetch resolves
    setRequestNumberByBookingId({});

    const uniqueBookingIds = [...new Set(preBanLogs.map((log) => log.bookingId))];
    Promise.allSettled(
      uniqueBookingIds.map((bookingId) =>
        clientGetDataByCalendarEventId<Booking>(
          TableNames.BOOKING,
          bookingId,
          tenant ?? undefined,
        ).then((booking) => ({ bookingId, requestNumber: booking?.requestNumber })),
      ),
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, number | undefined> = {};
      let failureCount = 0;
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          const { bookingId: id, requestNumber } = result.value;
          map[id] = requestNumber;
        } else {
          failureCount += 1;
        }
      });
      if (failureCount > 0) {
        console.warn(
          `PreBan: could not load requestNumber for ${failureCount} of ${uniqueBookingIds.length} booking(s); those cells will show "--".`,
        );
      }
      setRequestNumberByBookingId(map);
    });

    return () => {
      cancelled = true;
    };
  }, [preBanLogs, tenant]);

  useEffect(() => {
    if (selectedEmail) {
      setDetailSortBy("date");
      setDetailSortOrder("desc");
    }
  }, [selectedEmail]);

  const sortedDetailsForOverlay = useMemo(() => {
    if (!selectedEmail) return [];
    const list = detailsByEmail[selectedEmail];
    if (!list?.length) return [];
    return [...list].sort((a, b) =>
      comparePreBanDetails(
        a,
        b,
        detailSortBy,
        detailSortOrder,
        requestNumberByBookingId,
      ),
    );
  }, [
    selectedEmail,
    detailsByEmail,
    detailSortBy,
    detailSortOrder,
    requestNumberByBookingId,
  ]);

  const handleDetailSort = (column: DetailSortColumn) => {
    if (detailSortBy === column) {
      setDetailSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setDetailSortBy(column);
      setDetailSortOrder(column === "date" ? "desc" : "asc");
    }
  };

  const handleCloseDetails = () => {
    setSelectedEmail(null);
  };

  const columnFormatters = {
    details: (value: string) => (
      <IconButton onClick={() => setSelectedEmail(value)}>
        <Info />
      </IconButton>
    ),
  };

  const handleRemoveAllRecords = async (email: string) => {
    try {
      // Get all record IDs for this email
      const recordIds = detailsByEmail[email]?.map((detail) => detail.id) || [];

      // Delete all records in parallel
      await Promise.all(
        recordIds.map((id) =>
          clientDeleteDataFromFirestore(TableNames.PRE_BAN_LOGS, id),
        ),
      );

      // Refresh the table
      await reloadPreBanLogs();
    } catch (error) {
      console.error("Failed to remove records:", error);
      alert("Failed to remove records");
    }
  };

  const handleToggleExcused = async (
    logId: string,
    nextExcused: boolean,
  ) => {
    try {
      setExcuseSavingById((prev) => ({ ...prev, [logId]: true }));
      await clientUpdateDataInFirestore(
        TableNames.PRE_BAN_LOGS,
        logId,
        { excused: nextExcused },
      );
      await reloadPreBanLogs();
    } catch (error) {
      console.error("Failed to update excused:", error);
      alert("Failed to update excused");
    } finally {
      setExcuseSavingById((prev) => ({ ...prev, [logId]: false }));
    }
  };

  return (
    <>
      <ListTable
        columnNameToRemoveBy="email"
        tableName={TableNames.PRE_BAN_LOGS}
        rows={rows}
        rowsRefresh={reloadPreBanLogs}
        columnFormatters={columnFormatters}
        topRow={
          <div style={{ paddingLeft: "16px", color: "rgba(0,0,0,0.6)" }}>
            Pre-banned Users
          </div>
        }
        onRemoveRow={(row) => handleRemoveAllRecords(row.email)}
      />

      <Dialog open={!!selectedEmail} onClose={handleCloseDetails}>
        <DialogTitle>Details for {selectedEmail}</DialogTitle>
        <DialogContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell
                  sortDirection={
                    detailSortBy === "date" ? detailSortOrder : false
                  }
                >
                  <TableSortLabel
                    active={detailSortBy === "date"}
                    direction={
                      detailSortBy === "date" ? detailSortOrder : "asc"
                    }
                    onClick={() => handleDetailSort("date")}
                  >
                    Date
                  </TableSortLabel>
                </TableCell>
                <TableCell
                  sortDirection={
                    detailSortBy === "status" ? detailSortOrder : false
                  }
                >
                  <TableSortLabel
                    active={detailSortBy === "status"}
                    direction={
                      detailSortBy === "status" ? detailSortOrder : "asc"
                    }
                    onClick={() => handleDetailSort("status")}
                  >
                    Status
                  </TableSortLabel>
                </TableCell>
                <TableCell
                  sortDirection={
                    detailSortBy === "requestNumber" ? detailSortOrder : false
                  }
                >
                  <TableSortLabel
                    active={detailSortBy === "requestNumber"}
                    direction={
                      detailSortBy === "requestNumber"
                        ? detailSortOrder
                        : "asc"
                    }
                    onClick={() => handleDetailSort("requestNumber")}
                  >
                    Request #
                  </TableSortLabel>
                </TableCell>
                <TableCell
                  sortDirection={
                    detailSortBy === "excused" ? detailSortOrder : false
                  }
                >
                  <TableSortLabel
                    active={detailSortBy === "excused"}
                    direction={
                      detailSortBy === "excused" ? detailSortOrder : "asc"
                    }
                    onClick={() => handleDetailSort("excused")}
                  >
                    Excused
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {selectedEmail &&
                sortedDetailsForOverlay.map((detail) => (
                  <TableRow key={detail.id}>
                    <TableCell>{detail.date}</TableCell>
                    <TableCell>{detail.status}</TableCell>
                    <TableCell>{requestNumberByBookingId[detail.bookingId] ?? "--"}</TableCell>
                    <TableCell>
                      <Checkbox
                        checked={detail.excused}
                        disabled={excuseSavingById[detail.id] === true}
                        onChange={(e) =>
                          handleToggleExcused(detail.id, e.target.checked)
                        }
                        inputProps={{
                          "aria-label": `Excused ${detail.status} on ${detail.date}`,
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </>
  );
};
