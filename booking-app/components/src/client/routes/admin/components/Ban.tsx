import React, { useContext, useState } from "react";
import {
  Button,
  Stack,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { formatInTimeZone } from "date-fns-tz";
import { useParams } from "next/navigation";

import {
  clientDeleteDataFromFirestore,
  clientSaveDataToFirestore,
} from "@/lib/firebase/firebase";
import { wrapTimestamp } from "@/lib/api/firestoreShared";
import { DatabaseContext } from "../../components/Provider";
import Table, { TableEmpty } from "../../components/Table";
import ListTableRow from "../../components/ListTableRow";
import { TableNames } from "../../../../policy";
import { TIMEZONE } from "../../../utils/date";
import {
  addBanWindow,
  banWindowStatus,
  formatBanInstant as formatBanTime,
  parseBanLocal,
} from "../../../../utils/banWindow";

const BLANK = "—";
const CONTROL_HEIGHT = 40;
const COLUMN_NAMES = ["email", "status", "start", "end"];

const inputSx = {
  "& .MuiInputBase-root": { height: CONTROL_HEIGHT },
};

const buttonSx = {
  height: CONTROL_HEIGHT,
  flexShrink: 0,
};

function initialStartLocal(): string {
  return formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm");
}

function formatBanInstant(value: unknown): string {
  return formatBanTime(value) || BLANK;
}

export const BannedUsers = () => {
  const { bannedUsers, reloadBannedUsers } = useContext(DatabaseContext);
  const params = useParams<{ tenant?: string }>();
  const tenant = typeof params?.tenant === "string" ? params.tenant : undefined;
  const [permanentEmail, setPermanentEmail] = useState("");
  const [timedEmail, setTimedEmail] = useState("");
  const [startLocal, setStartLocal] = useState(initialStartLocal);
  const [endLocal, setEndLocal] = useState(
    () => addBanWindow(startLocal) ?? "",
  );
  const [endTouched, setEndTouched] = useState(false);
  const [saving, setSaving] = useState<"permanent" | "timed" | null>(null);

  const rows = [...bannedUsers]
    .sort((a, b) => a.email.localeCompare(b.email))
    .map((ban) => {
      const status = banWindowStatus(ban);
      return {
        id: ban.id ?? ban.email,
        email: ban.email,
        status: status.charAt(0).toUpperCase() + status.slice(1),
        start: formatBanInstant(ban.startsAt),
        end: formatBanInstant(ban.endsAt),
      };
    });

  const emailTaken = (email: string) =>
    bannedUsers.some((ban) => {
      if (ban.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
        return false;
      }
      const status = banWindowStatus(ban);
      return status !== "expired" && status !== "invalid";
    });

  const saveBan = async (
    email: string,
    window?: { startsAt: Date; endsAt: Date },
  ): Promise<boolean> => {
    const trimmed = email.trim();
    if (!trimmed.includes("@")) {
      alert("Enter an email address");
      return false;
    }
    if (emailTaken(trimmed)) {
      alert("This user has already been added");
      return false;
    }
    await clientSaveDataToFirestore(
      TableNames.BANNED,
      {
        email: trimmed,
        createdAt: wrapTimestamp(Date.now()),
        ...(window
          ? {
              startsAt: wrapTimestamp(window.startsAt),
              endsAt: wrapTimestamp(window.endsAt),
            }
          : {}),
      },
      tenant,
    );
    await reloadBannedUsers();
    return true;
  };

  const addPermanent = async () => {
    setSaving("permanent");
    try {
      if (await saveBan(permanentEmail)) setPermanentEmail("");
    } catch (error) {
      console.error(error);
      alert("Failed to add user");
    } finally {
      setSaving(null);
    }
  };

  const addTimed = async () => {
    const start = parseBanLocal(startLocal);
    const end = parseBanLocal(endLocal);
    if (!start || !end) {
      alert("Enter a start and end time");
      return;
    }
    if (end.getTime() <= start.getTime()) {
      alert("End time must be after the start time");
      return;
    }
    setSaving("timed");
    try {
      const saved = await saveBan(timedEmail, { startsAt: start, endsAt: end });
      if (!saved) return;
      setTimedEmail("");
      const nextStart = initialStartLocal();
      setStartLocal(nextStart);
      setEndLocal(addBanWindow(nextStart) ?? "");
      setEndTouched(false);
    } catch (error) {
      console.error(error);
      alert("Failed to add user");
    } finally {
      setSaving(null);
    }
  };

  const columns = [
    <TableCell key="email">Email</TableCell>,
    <TableCell key="status">Status</TableCell>,
    <TableCell key="start">Start</TableCell>,
    <TableCell key="end">End</TableCell>,
    <TableCell key="action" align="right">
      Action
    </TableCell>,
  ];

  return (
    <Stack spacing={2} sx={{ width: "100%" }}>
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        flexWrap="wrap"
        alignItems="flex-end"
        sx={{ width: "100%" }}
      >
        <TextField
          size="small"
          placeholder="Add email"
          value={permanentEmail}
          onChange={(event) => setPermanentEmail(event.target.value)}
          inputProps={{ "aria-label": "Permanent ban email" }}
          sx={inputSx}
        />
        <Button
          variant="outlined"
          size="small"
          onClick={addPermanent}
          disabled={saving != null}
          sx={buttonSx}
        >
          Ban permanently
        </Button>
      </Stack>
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        flexWrap="wrap"
        alignItems="flex-end"
        sx={{ width: "100%" }}
      >
        <TextField
          size="small"
          placeholder="Add email"
          value={timedEmail}
          onChange={(event) => setTimedEmail(event.target.value)}
          inputProps={{ "aria-label": "Temporary ban email" }}
          sx={inputSx}
        />
        <TextField
          size="small"
          label="Start (ET)"
          type="datetime-local"
          value={startLocal}
          onChange={(event) => {
            const next = event.target.value;
            setStartLocal(next);
            if (!endTouched) {
              setEndLocal(addBanWindow(next) ?? "");
            }
          }}
          InputLabelProps={{ shrink: true }}
          inputProps={{ "aria-label": "Ban start" }}
          sx={inputSx}
        />
        <TextField
          size="small"
          label="End (ET)"
          type="datetime-local"
          value={endLocal}
          onChange={(event) => {
            setEndTouched(true);
            setEndLocal(event.target.value);
          }}
          InputLabelProps={{ shrink: true }}
          inputProps={{ "aria-label": "Ban end" }}
          sx={inputSx}
        />
        <Button
          variant="outlined"
          size="small"
          onClick={addTimed}
          disabled={saving != null}
          sx={buttonSx}
        >
          Ban until end
        </Button>
      </Stack>
      <Typography variant="body2" sx={{ color: "rgba(0,0,0,0.6)" }}>
        The end time defaults to one week after the start. Times are Eastern. A
        timed ban blocks new bookings only until it ends.
      </Typography>
      <Table
        columns={columns}
        sx={{ "& th": { paddingRight: "16px !important" } }}
        topRow={
          <div style={{ paddingLeft: "16px", color: "rgba(0,0,0,0.6)" }}>
            Banned Users
          </div>
        }
      >
        {rows.length === 0
          ? [
              <TableRow key="empty">
                <TableCell colSpan={columns.length} sx={{ borderBottom: 0 }}>
                  <TableEmpty>No banned users</TableEmpty>
                </TableCell>
              </TableRow>,
            ]
          : rows.map((row, index) => (
              <ListTableRow
                key={row.id}
                index={index}
                columnNames={COLUMN_NAMES}
                columnFormatters={{}}
                row={row}
                refresh={reloadBannedUsers}
                removeRow={() =>
                  clientDeleteDataFromFirestore(TableNames.BANNED, row.id, tenant)
                }
              />
            ))}
      </Table>
    </Stack>
  );
};
