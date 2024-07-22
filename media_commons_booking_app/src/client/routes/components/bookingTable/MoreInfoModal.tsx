import {
  Alert,
  Box,
  Button,
  Modal,
  Table,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material';

import { BookingRow } from '../../../../types';
import { Event } from '@mui/icons-material';
import Grid from '@mui/material/Unstable_Grid2/Grid2';
import React from 'react';
import { RoomDetails } from '../../booking/components/BookingSelection';
import StackedTableCell from './StackedTableCell';
import StatusChip from './StatusChip';
import { formatTimeAmPm } from '../../../utils/date';
import { styled } from '@mui/system';

interface Props {
  booking: BookingRow;
  closeModal: () => void;
}

const modalStyle = {
  position: 'absolute' as 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '75vw',
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  padding: 4,
};

const LabelCell = styled(TableCell)(({ theme }) => ({
  borderRight: `1px solid ${theme.palette.custom.border}`,
  width: 175,
  verticalAlign: 'top',
}));

const AlertHeader = styled(Alert)(({ theme }) => ({
  background: theme.palette.secondary.light,

  '.MuiAlert-icon': {
    color: theme.palette.primary.main,
  },
}));

const BLANK = 'None';

export default function MoreInfoModal({ booking, closeModal }: Props) {
  return (
    <Modal open={booking != null} onClose={closeModal}>
      <Box sx={modalStyle}>
        <AlertHeader color="info" icon={<Event />} sx={{ marginBottom: 3 }}>
          <RoomDetails container>
            <label>Rooms:</label>
            <p>{booking.roomId}</p>
          </RoomDetails>
          <RoomDetails container>
            <label>Date:</label>
            <p>{new Date(booking.startDate).toLocaleDateString()}</p>
          </RoomDetails>
          <RoomDetails container>
            <label>Time:</label>
            <p>{`${formatTimeAmPm(booking.startDate)} - ${formatTimeAmPm(
              booking.endDate
            )}`}</p>
          </RoomDetails>
          <RoomDetails container>
            <label>Status:</label>
            <p>{booking.status}</p>
          </RoomDetails>
        </AlertHeader>
        <Grid container columnSpacing={2}>
          <Grid xs={6}>
            <Typography variant="h6">Requestor</Typography>
            <Table size="small" sx={{ marginBottom: 3 }}>
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
            </Table>
          </Grid>

          <Grid xs={6}>
            <Typography variant="h6">Details</Typography>
            <Table size="small" sx={{ marginBottom: 3 }}>
              <TableRow>
                <LabelCell>Title</LabelCell>
                <TableCell>{booking.title}</TableCell>
              </TableRow>
              <TableRow>
                <LabelCell>Description</LabelCell>
                <TableCell>{booking.description}</TableCell>
              </TableRow>
              <TableRow>
                <LabelCell>Reservation Type</LabelCell>
                <TableCell>{booking.reservationType}</TableCell>
              </TableRow>
              <TableRow>
                <LabelCell>Expected Attendance</LabelCell>
                <TableCell>{booking.expectedAttendance}</TableCell>
              </TableRow>
              <TableRow>
                <LabelCell>Attendee Affiliation</LabelCell>
                <TableCell>{booking.attendeeAffiliation}</TableCell>
              </TableRow>
            </Table>
          </Grid>

          <Typography variant="h6">Services</Typography>
          <Table size="small">
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
                {booking.mediaServices.length === 0
                  ? BLANK
                  : booking.mediaServices
                      .split(', ')
                      .map((service) => (
                        <p style={{ fontWeight: 500 }}>{service.trim()}</p>
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
                topText={booking.hireSecurity === 'yes' ? 'Yes' : BLANK}
                bottomText={booking.chartFieldForSecurity}
              />
            </TableRow>
          </Table>
        </Grid>

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            mt: 2,
          }}
        >
          <Button variant="text" onClick={closeModal}>
            Close
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}
