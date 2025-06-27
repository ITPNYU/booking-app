import { Box } from "@mui/material";
import BookingBlackoutPeriods from "./policySettings/BookingBlackoutPeriods";
import FinalApprover from "./policySettings/FinalApprover";
import OperationalHours from "./policySettings/OperationalHours";

export default function PolicySettings() {
  return (
    <Box>
      <BookingBlackoutPeriods />
      <FinalApprover />
      <OperationalHours />
    </Box>
  );
}
