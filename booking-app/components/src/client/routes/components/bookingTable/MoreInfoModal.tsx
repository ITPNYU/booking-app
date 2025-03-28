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

import { BookingRow } from "../../../../types";
import { default as CustomTable } from "../Table";
import { Event } from "@mui/icons-material";
import Grid from "@mui/material/Unstable_Grid2/Grid2";
import React from "react";
import { RoomDetails } from "../../booking/components/BookingSelection";
import StackedTableCell from "./StackedTableCell";
import { formatTimeAmPm } from "../../../utils/date";
import { styled } from "@mui/system";
import useSortBookingHistory from "../../hooks/useSortBookingHistory";

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

const BLANK = "None";

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

            <SectionTitle>Requestor</SectionTitle>
            <Table size="small" sx={{ marginBottom: 3 }}>
              <TableBody>
                <TableRow>
                  <LabelCell>NetID / Name</LabelCell>
                  <StackedTableCell
                    topText={booking.netId}
                    bottomText={`${booking.firstName} ${booking.lastName}`}
                  />
                </TableRow>
                <TableRow>
                  <LabelCell>Contact Info</LabelCell>
                  <StackedTableCell
                    topText={booking.email}
                    bottomText={booking.phoneNumber}
                  />
                </TableRow>
                <TableRow>
                  <LabelCell>N-Number </LabelCell>
                  <TableCell>{booking.nNumber}</TableCell>
                </TableRow>
                <TableRow>
                  <LabelCell>Secondary Contact</LabelCell>
                  <TableCell>{booking.secondaryName || BLANK}</TableCell>
                </TableRow>
                <TableRow>
                  <LabelCell>Sponsor</LabelCell>
                  <StackedTableCell
                    topText={booking.sponsorEmail || BLANK}
                    bottomText={`${booking.sponsorFirstName} ${booking.sponsorLastName}`}
                  />
                </TableRow>
              </TableBody>
            </Table>

            <SectionTitle>Details</SectionTitle>
            <Table size="small" sx={{ marginBottom: 3 }}>
              <TableBody>
                <TableRow>
                  <LabelCell>Title</LabelCell>
                  <TableCell>{booking.title}</TableCell>
                </TableRow>
                <TableRow>
                  <LabelCell>Description</LabelCell>
                  <TableCell>{booking.description}</TableCell>
                </TableRow>
                <TableRow>
                  <LabelCell>Booking Type</LabelCell>
                  <TableCell>{booking.bookingType}</TableCell>
                </TableRow>
                <TableRow>
                  <LabelCell>Expected Attendance</LabelCell>
                  <TableCell>{booking.expectedAttendance}</TableCell>
                </TableRow>
                <TableRow>
                  <LabelCell>Attendee Affiliation</LabelCell>
                  <TableCell>{booking.attendeeAffiliation}</TableCell>
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
