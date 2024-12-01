import { Box, Switch, Typography } from "@mui/material";
import { Days, OperationHours } from "@/components/src/types";
import { LocalizationProvider, TimePicker } from "@mui/x-date-pickers";
import { useContext, useEffect, useState } from "react";

import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatabaseContext } from "../../../components/Provider";
import dayjs from "dayjs";
import styled from "styled-components";
import { updateOperationHours } from "@/components/src/server/db";

const Row = styled(Box)`
  display: grid;
  grid-template-columns: 100px 1fr;
  align-items: center;
`;

interface Props {
  day: Days;
  setting: OperationHours;
  roomId?: number;
}

export default function OperationalHoursRow({ day, setting, roomId }: Props) {
  const { reloadOperationHours } = useContext(DatabaseContext);

  const [closed, setClosed] = useState(setting?.isClosed || false);
  const [openDate, setOpenDate] = useState(
    dayjs(new Date().setHours(setting?.open, 0, 0, 0))
  );
  const [closeDate, setCloseDate] = useState(
    dayjs(new Date().setHours(setting?.close, 0, 0, 0))
  );

  const handleSwitch = (e) => {
    setClosed(!e.target.checked);
    updateOperationHours(
      day,
      openDate.hour(),
      closeDate.hour(),
      !e.target.checked,
      roomId
    );
  };

  const handleOpenChange = (e) => {
    setOpenDate(e);
    updateOperationHours(day, e["$H"], closeDate.hour(), closed, roomId);
  };

  const handleCloseChange = (e) => {
    setCloseDate(e);
    updateOperationHours(day, openDate.hour(), e["$H"], closed, roomId);
  };

  // when we leave the page, the app reloads the newly set operation hours
  useEffect(() => {
    return () => {
      reloadOperationHours();
    };
  });

  return (
    <Box sx={{ p: 1 }}>
      <Row>
        <Typography>{day}</Typography>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <TimePicker
              value={openDate}
              onChange={handleOpenChange}
              disabled={closed}
            />
            <Typography p={2}>--</Typography>
            <TimePicker
              value={closeDate}
              onChange={handleCloseChange}
              disabled={closed}
            />
          </LocalizationProvider>
          <Switch checked={!closed} onChange={handleSwitch} />
        </Box>
      </Row>
    </Box>
  );
}
