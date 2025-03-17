import React, { useContext, useEffect, useState } from "react";
import { DatabaseContext } from "../../components/Provider";
import { formatDate } from "../../../utils/date";
import { TableNames } from "../../../../policy";
import ListTable from "../../components/ListTable";
import { PreBanLog } from "../../../../types";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Typography,
} from "@mui/material";
import { Info } from "@mui/icons-material";
import { clientDeleteDataFromFirestore } from "@/lib/firebase/firebase";

interface PreBanDetails {
  date: string;
  status: "Late Cancel" | "No Show";
  id: string;
}

interface DetailsByEmail {
  [email: string]: PreBanDetails[];
}

export const PreBannedUsers = () => {
  const { preBanLogs, reloadPreBanLogs } = useContext(DatabaseContext);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [detailsByEmail, setDetailsByEmail] = useState<DetailsByEmail>({});
  const [rows, setRows] = useState<Array<{ [key: string]: string }>>([]);

  useEffect(() => {
    reloadPreBanLogs();
  }, []);

  useEffect(() => {
    const details: DetailsByEmail = {};
    const counts: { [email: string]: number } = {};

    // Process logs into details and counts
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
        status: log.lateCancelDate ? "Late Cancel" : "No Show",
        id: log.id
      });
      counts[email]++;
    });

    // Update state
    setDetailsByEmail(details);
    setRows(
      Object.entries(counts).map(([email, count]) => ({
        id: email,
        email: email,
        count: String(count),
        details: email
      }))
    );
  }, [preBanLogs]);

  const handleCloseDetails = () => {
    setSelectedEmail(null);
  };

  const columnFormatters = {
    details: (value: string) => (
      <IconButton onClick={() => setSelectedEmail(value)}>
        <Info />
      </IconButton>
    )
  };

  const handleRemoveAllRecords = async (email: string) => {
    try {
      // Get all record IDs for this email
      const recordIds = detailsByEmail[email]?.map(detail => detail.id) || [];
      
      // Delete all records in parallel
      await Promise.all(
        recordIds.map(id => 
          clientDeleteDataFromFirestore(TableNames.PRE_BAN_LOGS, id)
        )
      );

      // Refresh the table
      await reloadPreBanLogs();
    } catch (error) {
      console.error("Failed to remove records:", error);
      alert("Failed to remove records");
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
                <TableCell>Date</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {selectedEmail &&
                detailsByEmail[selectedEmail]?.map((detail, index) => (
                  <TableRow key={index}>
                    <TableCell>{detail.date}</TableCell>
                    <TableCell>{detail.status}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </>
  );
};
