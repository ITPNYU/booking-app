import { Typography } from "@mui/material";
import { EquipmentUsers } from "./EquipmentUsers";
import { Liaisons } from "./Liaisons";

export const Approvers = () => (
  <div>
    <Typography style={{ marginBottom: 24 }} variant="h6">
      Liaison Users
    </Typography>
    <Liaisons />
    <Typography style={{ marginTop: 48, marginBottom: 24 }} variant="h6">
      Equipment Users
    </Typography>
    <EquipmentUsers />
  </div>
);
