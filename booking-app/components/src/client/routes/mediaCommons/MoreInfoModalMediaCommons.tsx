import {
  MODAL_BLANK,
  ModalLabelCell,
  ModalSectionTitle,
} from "../components/bookingTable/MoreInfoModalUtil";
import { Table, TableBody, TableCell, TableRow } from "@mui/material";

import { BookingRowMediaCommons } from "@/components/src/typesMediaCommons";
import StackedTableCell from "../components/bookingTable/StackedTableCell";

interface Props {
  booking: BookingRowMediaCommons;
}

export default function MoreInfoModalMediaCommons({ booking }: Props) {
  return (
    <>
      <ModalSectionTitle>Requestor</ModalSectionTitle>
      <Table size="small" sx={{ marginBottom: 3 }}>
        <TableBody>
          <TableRow>
            <ModalLabelCell>NetID / Name</ModalLabelCell>
            <StackedTableCell
              topText={booking.netId}
              bottomText={`${booking.firstName} ${booking.lastName}`}
            />
          </TableRow>
          <TableRow>
            <ModalLabelCell>Contact Info</ModalLabelCell>
            <StackedTableCell
              topText={booking.email}
              bottomText={booking.phoneNumber}
            />
          </TableRow>
          <TableRow>
            <ModalLabelCell>N-Number </ModalLabelCell>
            <TableCell>{booking.nNumber}</TableCell>
          </TableRow>
          <TableRow>
            <ModalLabelCell>Secondary Contact</ModalLabelCell>
            <TableCell>{booking.secondaryName || MODAL_BLANK}</TableCell>
          </TableRow>
          <TableRow>
            <ModalLabelCell>Sponsor</ModalLabelCell>
            <StackedTableCell
              topText={booking.sponsorEmail || MODAL_BLANK}
              bottomText={`${booking.sponsorFirstName} ${booking.sponsorLastName}`}
            />
          </TableRow>
        </TableBody>
      </Table>

      <ModalSectionTitle>Details</ModalSectionTitle>
      <Table size="small" sx={{ marginBottom: 3 }}>
        <TableBody>
          <TableRow>
            <ModalLabelCell>Title</ModalLabelCell>
            <TableCell>{booking.title}</TableCell>
          </TableRow>
          <TableRow>
            <ModalLabelCell>Description</ModalLabelCell>
            <TableCell>{booking.description}</TableCell>
          </TableRow>
          <TableRow>
            <ModalLabelCell>Booking Type</ModalLabelCell>
            <TableCell>{booking.bookingType}</TableCell>
          </TableRow>
          <TableRow>
            <ModalLabelCell>Expected Attendance</ModalLabelCell>
            <TableCell>{booking.expectedAttendance}</TableCell>
          </TableRow>
          <TableRow>
            <ModalLabelCell>Attendee Affiliation</ModalLabelCell>
            <TableCell>{booking.attendeeAffiliation}</TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <ModalSectionTitle>Services</ModalSectionTitle>
      <Table size="small">
        <TableBody>
          <TableRow>
            <ModalLabelCell>Room Setup</ModalLabelCell>
            <StackedTableCell
              topText={booking.setupDetails || MODAL_BLANK}
              bottomText={booking.chartFieldForRoomSetup}
            />
          </TableRow>
          <TableRow>
            <ModalLabelCell>Media Service</ModalLabelCell>
            <TableCell>
              {booking.mediaServices == undefined
                ? MODAL_BLANK
                : booking.mediaServices
                    .split(", ")
                    .map((service) => <p key={service}>{service.trim()}</p>)}
              <p>{booking.mediaServicesDetails}</p>
            </TableCell>
          </TableRow>
          <TableRow>
            <ModalLabelCell>Catering</ModalLabelCell>
            <StackedTableCell
              topText={booking.cateringService || MODAL_BLANK}
              bottomText={booking.chartFieldForCatering}
            />
          </TableRow>
          <TableRow>
            <ModalLabelCell>Security</ModalLabelCell>
            <StackedTableCell
              topText={booking.hireSecurity === "yes" ? "Yes" : MODAL_BLANK}
              bottomText={booking.chartFieldForSecurity}
            />
          </TableRow>
        </TableBody>
      </Table>
    </>
  );
}
