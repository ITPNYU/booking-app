import { BookingRow, PageContextLevel } from "@/components/src/types";
import { Box, Typography } from "@mui/material";
import EquipmentCheckoutToggle from "./EquipmentCheckoutToggle";

interface Props {
  booking: BookingRow;
  onCartClick: () => void;
  pageContext: PageContextLevel;
}

export default function EquipmentCartDisplay({
  booking,
  onCartClick,
  pageContext,
}: Props) {
  const canShowCartNumber = pageContext >= PageContextLevel.PA;

  // If user is PA level or above and there's a cart number, display it as clickable text
  if (canShowCartNumber && booking.webcheckoutCartNumber) {
    return (
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <Typography
          variant="body2"
          onClick={onCartClick}
          sx={{
            cursor: "pointer",
          }}
        >
          {booking.webcheckoutCartNumber}
        </Typography>
      </Box>
    );
  }

  // For all other cases, display the equipment checkout toggle
  return (
    <EquipmentCheckoutToggle
      booking={booking}
      status={booking.equipmentCheckedOut}
    />
  );
}
