import { Box, Switch, Typography } from "@mui/material";
import { LocalizationProvider, TimePicker } from "@mui/x-date-pickers";

import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import styled from "styled-components";
import { useState } from "react";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const Row = styled(Box)`
  display: grid;
  grid-template-columns: 100px 1fr;
  align-items: center;
`;

function HoursRow({ day }) {
  const [closed, setClosed] = useState(false);

  const handleSwitch = (e) => {
    setClosed(!e.target.checked);
  };

  return (
    <Box sx={{ p: 1 }}>
      <Row>
        <Typography>{day}</Typography>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <TimePicker disabled={closed} />
            <Typography p={2}>--</Typography>
            <TimePicker disabled={closed} />
          </LocalizationProvider>
          <Switch checked={!closed} onChange={handleSwitch} />
        </Box>
      </Row>
    </Box>
  );
}

export default function OperationalHours() {
  return (
    <Box>
      <Typography variant="h6" mt={4}>
        Operational Hours
      </Typography>
      {DAYS.map((day) => (
        <HoursRow day={day} key={day} />
      ))}
    </Box>
  );
}
