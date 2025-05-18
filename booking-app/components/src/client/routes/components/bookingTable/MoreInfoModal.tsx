import {
  Alert,
  Box,
  Button,
  Modal,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from "@mui/material";

import { Event } from "@mui/icons-material";
import Grid from "@mui/material/Unstable_Grid2/Grid2";
import { styled } from "@mui/system";
import { BookingRow } from "../../../../types";
import { formatTimeAmPm } from "../../../utils/date";
import { RoomDetails } from "../../booking/components/BookingSelection";
import useSortBookingHistory from "../../hooks/useSortBookingHistory";
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

const BLANK = "N/A";

export default function MoreInfoModal({ booking, closeModal }: Props) {
  const historyRows = useSortBookingHistory(booking);

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
            <SectionTitle>History</SectionTitle>
            <StatusTable columns={historyCols} sx={{ marginBottom: 3 }}>
              {historyRows}
            </StatusTable>

            <SectionTitle>Request</SectionTitle>
            <Table size="small" sx={{ marginBottom: 3 }}>
              <TableBody>
                <TableRow>
                  <LabelCell>Request#</LabelCell>
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
                <TableRow>
                  <LabelCell>Origin</LabelCell>
                  <TableCell>{booking.origin ?? BLANK}</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <SectionTitle>Requestor</SectionTitle>
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
                  <LabelCell>Secondary Contact Email</LabelCell>
                  <TableCell>{booking.missingEmail || BLANK}</TableCell>
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
                    topText={booking.setupDetails || BLANK}
                    bottomText={booking.chartFieldForRoomSetup}
                  />
                </TableRow>
                <TableRow>
                  <LabelCell>Media Service</LabelCell>
                  <TableCell>
                    {booking.mediaServices == undefined
                      ? BLANK
                      : booking.mediaServices
                          .split(", ")
                          .map((service) => (
                            <p key={service}>{service.trim()}</p>
                          ))}
                    <p>{booking.mediaServicesDetails}</p>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <LabelCell>Catering</LabelCell>
                  <StackedTableCell
                    topText={booking.cateringService || BLANK}
                    bottomText={booking.chartFieldForCatering}
                  />
                </TableRow>
                <TableRow>
                  <LabelCell>Security</LabelCell>
                  <StackedTableCell
                    topText={booking.hireSecurity === "yes" ? "Yes" : BLANK}
                    bottomText={booking.chartFieldForSecurity}
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
