import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  SelectChangeEvent,
  Stack,
  Typography,
} from "@mui/material";
import { useContext, useState } from "react";

import { DatabaseContext } from "../../../components/Provider";
import { Days } from "@/components/src/types";
import { ExpandMore } from "@mui/icons-material";
import OperationalHoursRow from "./OperationalHoursRow";

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

export default function OperationalHours() {
  const { operationHours, roomSettings } = useContext(DatabaseContext);
  const [specialHourRooms, setSpecialHourRooms] = useState<number[]>(
    Array.from(
      new Set(operationHours.map((x) => x.roomId).filter((x) => x != null))
    ).sort((a, b) => a - b)
  ); // roomIds

  const handleChange = (event: SelectChangeEvent<typeof specialHourRooms>) => {
    const {
      target: { value },
    } = event;
    // On autofill we get a stringified value.
    let list =
      typeof value === "string"
        ? value.split(",").map((x) => Number(x))
        : value;
    setSpecialHourRooms(list.sort((a, b) => a - b));
  };

  return (
    <Box>
      <Typography variant="h6" mt={4}>
        Operational Hours
      </Typography>
      <Typography fontWeight={700}>Default Operational Hours</Typography>
      <p>
        All spaces will adhere to these operational hours unless otherwise
        specififed below
      </p>
      {Object.values(Days).map((day: Days) => (
        <OperationalHoursRow
          day={day}
          setting={operationHours.find(
            (x) => x.day === (day as Days) && x.roomId == null
          )}
          key={day}
        />
      ))}
      <Typography fontWeight={700} mt={3}>
        Special Operational Hours
      </Typography>
      <p>
        Select spaces from the dropdown below to define their operational hours
      </p>
      <Box m={1}>
        <FormControl sx={{ width: 300 }}>
          <InputLabel id="special-room-hours">Spaces</InputLabel>
          <Select
            labelId="special-room-hours"
            multiple
            value={specialHourRooms}
            onChange={handleChange}
            input={<OutlinedInput label="Spaces" />}
            renderValue={(selected) => (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {selected.map((value) => (
                  <Chip key={value} label={value} />
                ))}
              </Box>
            )}
            MenuProps={MenuProps}
          >
            {roomSettings.map((roomSetting) => (
              <MenuItem key={roomSetting.roomId} value={roomSetting.roomId}>
                {roomSetting.roomId} {roomSetting.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box maxWidth="50vw" mt={1}>
          <Stack
            divider={<Divider sx={{ borderColor: "#21212114" }} />}
            sx={{ border: "1px solid #21212114", borderRadius: "4px" }}
          >
            {specialHourRooms.map((roomId) => (
              <Accordion key={roomId} sx={{ boxShadow: "none" }}>
                <AccordionSummary
                  expandIcon={<ExpandMore />}
                  aria-controls="panel1-content"
                  id="panel1-header"
                >
                  {roomId}
                </AccordionSummary>
                <AccordionDetails>
                  {Object.values(Days).map((day: Days) => (
                    <OperationalHoursRow
                      day={day}
                      setting={operationHours.find(
                        (x) => x.day === (day as Days) && x.roomId === roomId
                      )}
                      roomId={roomId}
                      key={day}
                    />
                  ))}
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
