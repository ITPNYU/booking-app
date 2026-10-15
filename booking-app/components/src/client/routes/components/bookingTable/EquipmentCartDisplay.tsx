import { BookingRow, PageContextLevel } from "@/components/src/types";
import {
  canAccessWebCheckoutCart,
  isWebCheckoutContextAllowed,
} from "@/components/src/utils/bookingMemoAccess";
import { Box, Typography } from "@mui/material";
import { useContext } from "react";
import { DatabaseContext } from "../Provider";
import { useTenantSchema } from "../SchemaProvider";
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
  const { pagePermission } = useContext(DatabaseContext);
  const { detailsModal } = useTenantSchema();

  // Same gate as MoreInfoModal's WebCheckout section: the tenant's
  // detailsModal.showWebCheckout must be on, and both the page context and the
  // caller's role must be in webCheckoutViewRoles (or webCheckoutEditRoles).
  const canShowCartNumber =
    Boolean(detailsModal) &&
    isWebCheckoutContextAllowed(detailsModal, pageContext, "view") &&
    canAccessWebCheckoutCart(detailsModal, pagePermission, "view");

  // If the caller can see the cart and there's a cart number, display it as clickable text
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
