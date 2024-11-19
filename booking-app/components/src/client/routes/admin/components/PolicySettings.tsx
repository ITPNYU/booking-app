import { Box } from "@mui/material";
import FinalApprover from "./policySettings/FinalApprover";
import OperationalHours from "./OperationalHours";

export default function PolicySettings() {
  return (
    <Box>
      <FinalApprover />
      <OperationalHours />
    </Box>
  );
}
