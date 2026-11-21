import { BookingRow, PageContextLevel } from "@/components/src/types";
import {
  canAccessWebCheckoutCart,
  isWebCheckoutContextAllowed,
} from "@/components/src/utils/bookingMemoAccess";
import { Box, Typography } from "@mui/material";
import { useContext } from "react";
import { DatabaseContext } from "../Provider";
import { useTenantSchema } from "../SchemaProvider";

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

  // The column shows the WebCheckout cart number, clickable to open the
  // booking, and stays empty when there is none or the caller can't see it.
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

  return null;
}
