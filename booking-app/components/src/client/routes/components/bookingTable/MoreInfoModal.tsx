import {
  Alert,
  Box,
  Button,
  IconButton,
  Link,
  Modal,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import { Cancel, Check, Edit, Event } from "@mui/icons-material";
import Grid from "@mui/material/Unstable_Grid2/Grid2";
import { styled } from "@mui/system";
import React, { useContext, useState } from "react";
import { BookingRow, PagePermission } from "../../../../types";
import { formatTimeAmPm } from "../../../utils/date";
import { RoomDetails } from "../../booking/components/BookingSelection";
import useSortBookingHistory from "../../hooks/useSortBookingHistory";
import { DatabaseContext } from "../Provider";
import { default as CustomTable } from "../Table";
import StackedTableCell from "./StackedTableCell";

interface Props {
  booking: BookingRow;
  closeModal: () => void;
}

const modalStyle = {
  position: "absolute" as "absolute",
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

const SectionTitle = styled(Typography)({
  fontWeight: 700,
});
SectionTitle.defaultProps = {
  variant: "subtitle1",
};

const LabelCell = styled(TableCell)(({ theme }) => ({
  borderRight: `1px solid ${theme.palette.custom.border}`,
  width: 175,
  verticalAlign: "top",
}));

const AlertHeader = styled(Alert)(({ theme }) => ({
  background: theme.palette.secondary.light,

  ".MuiAlert-icon": {
    color: theme.palette.primary.main,
  },
}));

const BLANK = "none";

export default function MoreInfoModal({ booking, closeModal }: Props) {
  const historyRows = useSortBookingHistory(booking);
  const { pagePermission, userEmail } = useContext(DatabaseContext);

  const [isEditingCart, setIsEditingCart] = useState(false);
  const [cartNumber, setCartNumber] = useState(
    booking.webcheckoutCartNumber || ""
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [webCheckoutUrl, setWebCheckoutUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);

  // Check if user has permission to edit cart number
  const canEditCart =
    pagePermission === PagePermission.PA ||
    pagePermission === PagePermission.ADMIN;

  const handleSaveCartNumber = async () => {
    setIsUpdating(true);
    try {
      const response = await fetch("/api/updateWebcheckoutCart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          calendarEventId: booking.calendarEventId,
          cartNumber: cartNumber.trim(),
          userEmail: userEmail,
        }),
      });

      if (response.ok) {
        setIsEditingCart(false);
        // Notify parent to update the booking object
        updateBooking({
          ...booking,
          webcheckoutCartNumber: cartNumber.trim() || undefined,
        });
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error("Failed to update cart number:", error);
      alert("Failed to update cart number");
    }
    setIsUpdating(false);
  };

  const handleCancelEdit = () => {
    setCartNumber(booking.webcheckoutCartNumber || "");
    setIsEditingCart(false);
  };

  const fetchWebCheckoutUrl = async (cartNum: string) => {
    if (!cartNum) return;

    setIsLoadingUrl(true);
    try {
      const response = await fetch(`/api/webcheckout/cart/${cartNum}`);
      if (response.ok) {
        const data = await response.json();
        setWebCheckoutUrl(data.webCheckoutUrl);
      } else {
        console.error("Failed to fetch WebCheckout URL");
        setWebCheckoutUrl(null);
      }
    } catch (error) {
      console.error("Error fetching WebCheckout URL:", error);
      setWebCheckoutUrl(null);
    } finally {
      setIsLoadingUrl(false);
    }
  };

  // WebCheckout URLを取得（カート番号があるとき）
  React.useEffect(() => {
    if (booking.webcheckoutCartNumber) {
      fetchWebCheckoutUrl(booking.webcheckoutCartNumber);
    }
  }, [booking.webcheckoutCartNumber]);

  const renderWebCheckoutSection = () => {
    if (!canEditCart) {
      // Hide entire section if user doesn't have PA/Admin permissions
      return null;
    }

    return (
      <>
        <SectionTitle>WebCheckout</SectionTitle>
        <Table size="small" sx={{ marginBottom: 3 }}>
          <TableBody>
            <TableRow>
              <LabelCell>Cart Number</LabelCell>
              <TableCell>
                {isEditingCart ? (
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
                    >
                      <Check />
                    </IconButton>
                    <IconButton
                      onClick={handleCancelEdit}
                      disabled={isUpdating}
                      color="primary"
                    >
                      <Cancel />
                    </IconButton>
                  </Box>
                ) : (
                  <Box display="flex" alignItems="center" gap={1}>
                    {booking.webcheckoutCartNumber ? (
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2">
                          {booking.webcheckoutCartNumber}
                        </Typography>
                        {isLoadingUrl ? (
                          <Typography variant="body2" color="text.secondary">
                            Loading...
                          </Typography>
                        ) : webCheckoutUrl ? (
                          <Link
                            href={webCheckoutUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ fontSize: "0.875rem" }}
                          >
                            Open in WebCheckout
                          </Link>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Invalid cart
                          </Typography>
                        )}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No cart assigned
                      </Typography>
                    )}
                    {canEditCart && (
                      <Tooltip title="Edit cart number">
                        <IconButton
                          onClick={() => setIsEditingCart(true)}
                          color="primary"
                        >
                          <Edit />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </>
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
              <label>Request Number:</label>
              <p>{booking.requestNumber ?? "--"}</p>
            </RoomDetails>
            <RoomDetails container>
              <label>Rooms:</label>
              <p>{booking.roomId}</p>
            </RoomDetails>
            <RoomDetails container>
              <label>Date:</label>
              <p>{booking.startDate.toDate().toLocaleDateString()}</p>
            </RoomDetails>
            <RoomDetails container>
              <label>Time:</label>
              <p>{`${formatTimeAmPm(booking.startDate.toDate())} - ${formatTimeAmPm(
                booking.endDate.toDate()
              )}`}</p>
            </RoomDetails>
            <RoomDetails container>
              <label>Status:</label>
              <p>{booking.status}</p>
            </RoomDetails>
          </AlertHeader>
          <Grid container columnSpacing={2} margin={0}>
            {renderWebCheckoutSection()}

            <SectionTitle>History</SectionTitle>
            <StatusTable columns={historyCols} sx={{ marginBottom: 3 }}>
              {historyRows}
            </StatusTable>

            <SectionTitle>Request</SectionTitle>
            <Table size="small" sx={{ marginBottom: 3 }}>
              <TableBody>
                <TableRow>
                  <LabelCell>Request #</LabelCell>
                  <TableCell>{booking.requestNumber ?? BLANK}</TableCell>
                </TableRow>
                <TableRow>
                  <LabelCell>Room(s)</LabelCell>
                  <TableCell>{booking.roomId ?? BLANK}</TableCell>
                </TableRow>
                <TableRow>
                  <LabelCell>Date</LabelCell>
                  <TableCell>
                    {booking.startDate
                      ? booking.startDate.toDate().toLocaleDateString()
                      : BLANK}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <LabelCell>Time</LabelCell>
                  <TableCell>
                    {booking.startDate && booking.endDate
                      ? `${formatTimeAmPm(booking.startDate.toDate())} - ${formatTimeAmPm(booking.endDate.toDate())}`
                      : BLANK}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <LabelCell>Status</LabelCell>
                  <TableCell>{booking.status ?? BLANK}</TableCell>
                </TableRow>
                {booking.origin && (
                  <TableRow>
                    <LabelCell>Origin</LabelCell>
                    <TableCell>{booking.origin}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <SectionTitle>Requester</SectionTitle>
            <Table size="small" sx={{ marginBottom: 3 }}>
              <TableBody>
                <TableRow>
                  <LabelCell>NetID</LabelCell>
                  <TableCell>{booking.netId ?? BLANK}</TableCell>
                </TableRow>
                <TableRow>
                  <LabelCell>Name</LabelCell>
                  <TableCell>
                    {`${booking.firstName ?? ""} ${booking.lastName ?? ""}`.trim() ||
                      BLANK}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <LabelCell>Department</LabelCell>
                  <TableCell>{booking.department ?? BLANK}</TableCell>
                </TableRow>
                <TableRow>
                  <LabelCell>Role</LabelCell>
                  <TableCell>{booking.role ?? BLANK}</TableCell>
                </TableRow>
                <TableRow>
                  <LabelCell>Email</LabelCell>
                  <TableCell>{booking.email ?? BLANK}</TableCell>
                </TableRow>
                <TableRow>
                  <LabelCell>Phone</LabelCell>
                  <TableCell>{booking.phoneNumber ?? BLANK}</TableCell>
                </TableRow>
                <TableRow>
                  <LabelCell>Secondary Contact Name</LabelCell>
                  <TableCell>{booking.secondaryName || BLANK}</TableCell>
                </TableRow>
                <TableRow>
                  <LabelCell>Sponsor Name</LabelCell>
                  <TableCell>
                    {`${booking.sponsorFirstName ?? ""} ${booking.sponsorLastName ?? ""}`.trim() ||
                      BLANK}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <LabelCell>Sponsor Email</LabelCell>
                  <TableCell>{booking.sponsorEmail || BLANK}</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <SectionTitle>Details</SectionTitle>
            <Table size="small" sx={{ marginBottom: 3 }}>
              <TableBody>
                <TableRow>
                  <LabelCell>Title</LabelCell>
                  <TableCell>{booking.title ?? BLANK}</TableCell>
                </TableRow>
                <TableRow>
                  <LabelCell>Description</LabelCell>
                  <TableCell>{booking.description ?? BLANK}</TableCell>
                </TableRow>
                <TableRow>
                  <LabelCell>Booking Type</LabelCell>
                  <TableCell>{booking.bookingType ?? BLANK}</TableCell>
                </TableRow>
                <TableRow>
                  <LabelCell>Expected Attendance</LabelCell>
                  <TableCell>{booking.expectedAttendance ?? BLANK}</TableCell>
                </TableRow>
                <TableRow>
                  <LabelCell>Attendee Affiliation</LabelCell>
                  <TableCell>{booking.attendeeAffiliation ?? BLANK}</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <SectionTitle>Services</SectionTitle>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <LabelCell>Room Setup</LabelCell>
                  <StackedTableCell
                    topText={
                      booking.setupDetails ||
                      (booking.roomSetup === "no"
                        ? "none"
                        : booking.roomSetup || "none")
                    }
                    bottomText={booking.chartFieldForRoomSetup || "none"}
                  />
                </TableRow>
                <TableRow>
                  <LabelCell>Media Service</LabelCell>
                  <TableCell>
                    {booking.mediaServices == undefined
                      ? "none"
                      : booking.mediaServices
                          .split(", ")
                          .map((service) => (
                            <p key={service}>{service.trim()}</p>
                          ))}
                    <p>{booking.mediaServicesDetails || "none"}</p>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <LabelCell>Catering</LabelCell>
                  <StackedTableCell
                    topText={
                      booking.cateringService ||
                      (booking.catering === "no"
                        ? "none"
                        : booking.catering || "none")
                    }
                    bottomText={booking.chartFieldForCatering || "none"}
                  />
                </TableRow>
                <TableRow>
                  <LabelCell>Security</LabelCell>
                  <StackedTableCell
                    topText={booking.hireSecurity === "yes" ? "Yes" : "none"}
                    bottomText={booking.chartFieldForSecurity || "none"}
                  />
                </TableRow>
              </TableBody>
            </Table>
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
