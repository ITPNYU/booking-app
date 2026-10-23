import {
  Alert,
  Box,
  Button,
  IconButton,
  Modal,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { Cancel, Check, Edit, Event } from "@mui/icons-material";
import Grid from "@mui/material/Unstable_Grid2/Grid2";
import { styled } from "@mui/system";
import { useParams } from "next/navigation";
import React, { useContext, useState } from "react";
import { BOOKING_MEMO_MAX_LEN } from "@/components/src/constants/bookingMemo";
import {
  canAccessMemo,
  canAccessWebCheckoutCart,
  isMemoContextAllowed,
  isWebCheckoutContextAllowed,
} from "@/components/src/utils/bookingMemoAccess";
import { BookingRow, PageContextLevel } from "../../../../types";
import { useTenantSchema } from "../SchemaProvider";
import { formatTimeAmPm, formatDateTable } from "../../../utils/date";
import { RoomDetails } from "../../booking/components/BookingSelection";
import useSortBookingHistory from "../../hooks/useSortBookingHistory";
import { DatabaseContext } from "../Provider";
import { default as CustomTable } from "../Table";
import BookingDetailsSummary, {
  LabelCell,
  Section,
  SectionTitle,
} from "./BookingDetailsSummary";

interface Props {
  booking: BookingRow;
  closeModal: () => void;
  updateBooking?: (updatedBooking: BookingRow) => void;
  pageContext?: PageContextLevel;
}

const modalStyle = {
  position: "absolute" as const,
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  height: "90vh",
  width: "600px",
  bgcolor: "background.paper",
  boxShadow: 24,
  display: "grid",
  gridTemplateRows: "1fr 80px",
};

const ScrollableContent = styled(Box)({
  overflowY: "scroll",
});

const Footer = styled(Box)(({ theme }) => ({
  textAlign: "right",
  borderTop: `1px solid ${theme.palette.custom.border}`,
}));

const StatusTable = styled(CustomTable)({
  width: "100%",
});

const AlertHeader = styled(Alert)(({ theme }) => ({
  background: theme.palette.secondary.light,

  ".MuiAlert-icon": {
    color: theme.palette.primary.main,
  },
}));

export default function MoreInfoModal({
  booking,
  closeModal,
  updateBooking,
  pageContext,
}: Props) {
  const params = useParams();
  const tenant = (params?.tenant as string) || DEFAULT_TENANT;
  const historyRows = useSortBookingHistory(booking);
  const { pagePermission, userEmail } = useContext(DatabaseContext);
  const schema = useTenantSchema();

  const [isEditingCart, setIsEditingCart] = useState(false);
  const [cartNumber, setCartNumber] = useState(
    booking.webcheckoutCartNumber || "",
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [webCheckoutUrl, setWebCheckoutUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [webCheckoutData, setWebCheckoutData] = useState<any>(null);

  // Both the page context and the caller's role must be inside the tenant's
  // detailsModal.webCheckoutEditRoles to get the cart edit icon, the same way
  // as the memo. POST /api/updateWebcheckoutCart enforces the same list.
  const canEditCartInContext =
    isWebCheckoutContextAllowed(schema.detailsModal, pageContext, "edit") &&
    canAccessWebCheckoutCart(schema.detailsModal, pagePermission, "edit");

  const handleSaveCartNumber = async () => {
    if (!canEditCartInContext) {
      return;
    }

    setIsUpdating(true);
    setCartError(null);
    try {
      const response = await fetch("/api/updateWebcheckoutCart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(tenant ? { "x-tenant": tenant } : {}),
        },
        body: JSON.stringify({
          calendarEventId: booking.calendarEventId,
          cartNumber: cartNumber.trim(),
          userEmail,
        }),
      });

      // Only a 2xx means the cart number was persisted; on anything else keep
      // the editor open with the draft and show the error inline.
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setCartError(data?.error || "Failed to update cart number");
        return;
      }
      setIsEditingCart(false);
      // Update the booking object
      booking.webcheckoutCartNumber = cartNumber.trim() || undefined;
    } catch (error) {
      console.error("Failed to update cart number:", error);
      setCartError("Failed to update cart number");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setCartNumber(booking.webcheckoutCartNumber || "");
    setCartError(null);
    setIsEditingCart(false);
  };

  // Memo: staff-only free text (e.g. work order confirmation number), shown
  // directly under WebCheckout. Visibility and editing are governed by the
  // tenant schema's detailsModal.showMemo, memoViewRoles, and memoEditRoles.
  const [savedMemo, setSavedMemo] = useState(booking.memo ?? "");
  const [memoDraft, setMemoDraft] = useState(booking.memo ?? "");
  const [isEditingMemo, setIsEditingMemo] = useState(false);
  const [isSavingMemo, setIsSavingMemo] = useState(false);
  const [memoError, setMemoError] = useState<string | null>(null);

  // Both the page context and the caller's role must be inside the tenant's
  // configured memo roles: the view roles to see the section, the edit roles
  // to get its edit icon. The server enforces the same lists on reads and
  // writes.
  const showMemoSection =
    isMemoContextAllowed(schema.detailsModal, pageContext, "view") &&
    canAccessMemo(schema.detailsModal, pagePermission, "view");
  const canEditMemo =
    isMemoContextAllowed(schema.detailsModal, pageContext, "edit") &&
    canAccessMemo(schema.detailsModal, pagePermission, "edit");

  const handleStartEditMemo = () => {
    setMemoDraft(savedMemo);
    setMemoError(null);
    setIsEditingMemo(true);
  };

  const handleCancelEditMemo = () => {
    setMemoDraft(savedMemo);
    setMemoError(null);
    setIsEditingMemo(false);
  };

  const handleSaveMemo = async () => {
    if (!canEditMemo) {
      return;
    }
    const memo = memoDraft.trim();
    setIsSavingMemo(true);
    setMemoError(null);
    try {
      const response = await fetch("/api/bookings/memo", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(tenant ? { "x-tenant": tenant } : {}),
        },
        body: JSON.stringify({
          calendarEventId: booking.calendarEventId,
          memo,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setMemoError(data?.error || "Failed to save memo");
        return;
      }
      setSavedMemo(memo);
      setMemoDraft(memo);
      setIsEditingMemo(false);
      booking.memo = memo || undefined;
      updateBooking?.({ ...booking, memo: memo || undefined });
    } catch (error) {
      console.error("Failed to save memo:", error);
      setMemoError("Failed to save memo");
    } finally {
      setIsSavingMemo(false);
    }
  };

  const fetchWebCheckoutUrl = async (cartNum: string) => {
    setIsLoadingUrl(true);
    try {
      const response = await fetch(`/api/webcheckout/cart/${cartNum}`);
      if (response.ok) {
        const data = await response.json();
        setWebCheckoutUrl(data.webCheckoutUrl);
        setWebCheckoutData(data);
      } else {
        console.error("Failed to fetch WebCheckout URL");
        setWebCheckoutUrl(null);
        setWebCheckoutData(null);
      }
    } catch (error) {
      console.error("Error fetching WebCheckout URL:", error);
      setWebCheckoutUrl(null);
      setWebCheckoutData(null);
    } finally {
      setIsLoadingUrl(false);
    }
  };

  React.useEffect(() => {
    if (booking.webcheckoutCartNumber) {
      fetchWebCheckoutUrl(booking.webcheckoutCartNumber);
    }
  }, [booking.webcheckoutCartNumber]);

  const renderWebCheckoutSection = () => {
    // Show WebCheckout section to detailsModal.webCheckoutViewRoles (and
    // edit roles) on their own pages. In USER context, show read-only cart
    // details when a cart is assigned.
    const canViewWebCheckout =
      (isWebCheckoutContextAllowed(schema.detailsModal, pageContext, "view") &&
        canAccessWebCheckoutCart(
          schema.detailsModal,
          pagePermission,
          "view",
        )) ||
      (schema.detailsModal.showWebCheckout &&
        pageContext === PageContextLevel.USER &&
        Boolean(booking.webcheckoutCartNumber));

    if (!canViewWebCheckout) {
      return null;
    }

    return (
      <Section>
        <Box display="flex" alignItems="center" gap={1}>
          <SectionTitle>WebCheckout</SectionTitle>
          {canEditCartInContext && !isEditingCart && (
            <Tooltip title="Edit cart number">
              <IconButton
                onClick={() => setIsEditingCart(true)}
                color="primary"
                size="small"
                aria-label="Edit cart number"
              >
                <Edit fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        <Table size="small">
          <TableBody>
            <TableRow>
              <LabelCell>Cart Number</LabelCell>
              <TableCell>
                {isEditingCart ? (
                  <Box display="flex" flexDirection="column" gap={1}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <TextField
                        size="small"
                        value={cartNumber}
                        onChange={(e) => setCartNumber(e.target.value)}
                        placeholder="Enter cart number"
                        disabled={isUpdating}
                        variant="outlined"
                        sx={{
                          flexGrow: 1,
                          "& .MuiOutlinedInput-root": {
                            height: "40px",
                          },
                        }}
                      />
                      <IconButton
                        onClick={handleSaveCartNumber}
                        disabled={isUpdating}
                        color="primary"
                        aria-label="Save cart number"
                      >
                        <Check />
                      </IconButton>
                      <IconButton
                        onClick={handleCancelEdit}
                        disabled={isUpdating}
                        color="primary"
                        aria-label="Cancel editing cart number"
                      >
                        <Cancel />
                      </IconButton>
                    </Box>
                    {cartError && (
                      <Typography
                        variant="body2"
                        color="error"
                        role="alert"
                        data-testid="cart-number-error"
                      >
                        {cartError}
                      </Typography>
                    )}
                  </Box>
                ) : (
                  <Box display="flex" alignItems="center" gap={1}>
                    {booking.webcheckoutCartNumber ? (
                      <Box display="flex" flexDirection="column" gap={2}>
                        {/* Always show cart number */}
                        <Typography variant="body2">
                          {booking.webcheckoutCartNumber}
                        </Typography>

                        {/* Loading State */}
                        {isLoadingUrl && (
                          <Typography variant="body2" color="text.secondary">
                            Loading equipment information...
                          </Typography>
                        )}

                        {/* Equipment List Section */}
                        {webCheckoutData &&
                          webCheckoutData.equipmentGroups &&
                          webCheckoutData.equipmentGroups.length > 0 && (
                            <Box sx={{ marginTop: 1 }}>
                              <Box
                                display="flex"
                                alignItems="center"
                                gap={1}
                                sx={{ marginBottom: 1 }}
                              >
                                <Typography
                                  variant="subtitle2"
                                  sx={{ fontWeight: 600 }}
                                >
                                  Cart: {webCheckoutData.cartNumber} (
                                  {webCheckoutData.totalItems} items)
                                </Typography>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  onClick={() =>
                                    navigator.clipboard.writeText(
                                      webCheckoutUrl,
                                    )
                                  }
                                  sx={{
                                    fontSize: "0.7rem",
                                    textTransform: "none",
                                    padding: "2px 6px",
                                    minWidth: "auto",
                                    height: "24px",
                                  }}
                                >
                                  Copy Cart URL
                                </Button>
                              </Box>

                              {/* Display notes if available */}
                              {webCheckoutData.notes && (
                                <Box sx={{ marginTop: 1, marginBottom: 1 }}>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontWeight: 600,
                                      color: "#666",
                                      display: "block",
                                      marginBottom: 0.5,
                                    }}
                                  >
                                    Allocation Notes
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontSize: "0.875rem",
                                      color: "#333",
                                      backgroundColor: "#f5f5f5",
                                      padding: 1,
                                      borderRadius: 1,
                                      fontStyle: "italic",
                                    }}
                                  >
                                    {webCheckoutData.notes}
                                  </Typography>
                                </Box>
                              )}

                              <Box
                                sx={{
                                  maxHeight: 200,
                                  overflowY: "auto",
                                  backgroundColor: "#f9f9f9",
                                  padding: 1,
                                  borderRadius: 1,
                                }}
                              >
                                {webCheckoutData.equipmentGroups.map(
                                  (group: any, groupIndex: number) => (
                                    <Box
                                      key={groupIndex}
                                      sx={{ marginBottom: 2 }}
                                    >
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          fontWeight: 600,
                                          color:
                                            group.label === "Checked out"
                                              ? "#1976d2"
                                              : "#ed6c02",
                                          display: "block",
                                          marginBottom: 0.5,
                                        }}
                                      >
                                        {group.label}:
                                      </Typography>
                                      {group.items.map(
                                        (item: any, itemIndex: number) => (
                                          <Box
                                            key={itemIndex}
                                            sx={{
                                              marginBottom: 1,
                                              paddingLeft: 1,
                                            }}
                                          >
                                            <Typography
                                              variant="body2"
                                              sx={{
                                                fontSize: "0.875rem",
                                                fontWeight: 500,
                                                marginBottom: 0.5,
                                              }}
                                            >
                                              <strong>•</strong> {item.name}
                                            </Typography>
                                            {item.subitems &&
                                              item.subitems.map(
                                                (
                                                  subitem: any,
                                                  subIndex: number,
                                                ) => (
                                                  <Typography
                                                    key={subIndex}
                                                    variant="body2"
                                                    sx={{
                                                      fontSize: "0.8rem",
                                                      color: "#666",
                                                      lineHeight: 1.3,
                                                      paddingLeft: 2,
                                                      marginBottom: 0.25,
                                                    }}
                                                  >
                                                    - {subitem.label}
                                                  </Typography>
                                                ),
                                              )}
                                          </Box>
                                        ),
                                      )}
                                    </Box>
                                  ),
                                )}
                              </Box>
                            </Box>
                          )}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No cart assigned
                      </Typography>
                    )}
                  </Box>
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Section>
    );
  };

  const renderMemoSection = () => {
    if (!showMemoSection) {
      return null;
    }

    return (
      <Section data-testid="booking-memo-section">
        <Box display="flex" alignItems="center" gap={1}>
          <SectionTitle>Memo</SectionTitle>
          {canEditMemo && !isEditingMemo && (
            <Tooltip title="Edit memo">
              <IconButton
                onClick={handleStartEditMemo}
                color="primary"
                size="small"
                aria-label="Edit memo"
              >
                <Edit fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell>
                {canEditMemo && isEditingMemo ? (
                  <Box display="flex" flexDirection="column" gap={1}>
                    <TextField
                      size="small"
                      multiline
                      minRows={2}
                      maxRows={8}
                      value={memoDraft}
                      onChange={(e) => setMemoDraft(e.target.value)}
                      placeholder="e.g. Work order confirmation number"
                      disabled={isSavingMemo}
                      variant="outlined"
                      fullWidth
                      inputProps={{
                        "aria-label": "Memo",
                        maxLength: BOOKING_MEMO_MAX_LEN,
                      }}
                    />
                    {memoError && (
                      <Typography variant="body2" color="error">
                        {memoError}
                      </Typography>
                    )}
                    <Box display="flex" justifyContent="flex-end" gap={1}>
                      <IconButton
                        onClick={handleSaveMemo}
                        disabled={isSavingMemo}
                        color="primary"
                        aria-label="Save memo"
                      >
                        <Check />
                      </IconButton>
                      <IconButton
                        onClick={handleCancelEditMemo}
                        disabled={isSavingMemo}
                        color="primary"
                        aria-label="Cancel editing memo"
                      >
                        <Cancel />
                      </IconButton>
                    </Box>
                  </Box>
                ) : savedMemo ? (
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {savedMemo}
                  </Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No memo
                  </Typography>
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Section>
    );
  };

  const historyCols = [
    <TableCell key="status">Status</TableCell>,
    <TableCell key="user">User</TableCell>,
    <TableCell key="date">Date</TableCell>,
    <TableCell key="note">Note</TableCell>,
  ];

  return (
    <Modal open={booking != null} onClose={closeModal}>
      <Box sx={modalStyle}>
        <ScrollableContent padding={4}>
          <AlertHeader color="info" icon={<Event />} sx={{ marginBottom: 3 }}>
            <RoomDetails container>
              <span>Request Number:</span>
              <p>{booking.requestNumber ?? "--"}</p>
            </RoomDetails>
            <RoomDetails container>
              <span>Rooms:</span>
              <p>{booking.roomId}</p>
            </RoomDetails>
            <RoomDetails container>
              <span>Date:</span>
              <p>{formatDateTable(booking.startDate.toDate())}</p>
            </RoomDetails>
            <RoomDetails container>
              <span>Time:</span>
              <p>{`${formatTimeAmPm(booking.startDate.toDate())} - ${formatTimeAmPm(
                booking.endDate.toDate(),
              )}`}</p>
            </RoomDetails>
            <RoomDetails container>
              <span>Status:</span>
              <p>{booking.status}</p>
            </RoomDetails>
          </AlertHeader>
          <Grid container columnSpacing={2} margin={0}>
            {renderWebCheckoutSection()}
            {renderMemoSection()}

            <Section>
              <SectionTitle>History</SectionTitle>
              <StatusTable columns={historyCols}>{historyRows}</StatusTable>
            </Section>

            <BookingDetailsSummary booking={booking} />
          </Grid>
        </ScrollableContent>

        <Footer pr={4} pt={2}>
          <Button variant="text" onClick={closeModal}>
            Close
          </Button>
        </Footer>
      </Box>
    </Modal>
  );
}
