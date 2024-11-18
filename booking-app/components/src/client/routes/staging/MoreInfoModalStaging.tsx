import {
  ModalLabelCell,
  ModalSectionTitle,
} from "../components/bookingTable/MoreInfoModalUtil";
import { Table, TableBody, TableCell, TableRow } from "@mui/material";

import { BookingRowStaging } from "@/components/src/typesStaging";
import StackedTableCell from "../components/bookingTable/StackedTableCell";

interface Props {
  booking: BookingRowStaging;
}

export default function MoreInfoModalStaging({ booking }: Props) {
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
            <TableCell>{booking.email}</TableCell>
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
            <ModalLabelCell>Project URL</ModalLabelCell>
            <TableCell>
              <a
                href={booking.projectDatabaseUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {booking.projectDatabaseUrl}
              </a>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </>
  );
}
