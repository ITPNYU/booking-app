import { BookingRow, BookingStatusLabel } from "../../../../types";
import {
  IconButton,
  TableCell,
  TableRow,
  Tooltip,
  tooltipClasses,
} from "@mui/material";
import React, { useContext, useMemo, useRef, useState } from "react";
import { formatDateTable, formatTimeTable } from "../../../utils/date";

import BookingActions from "../../admin/components/BookingActions";
import { DatabaseContext } from "../Provider";
import MoreHoriz from "@mui/icons-material/MoreHoriz";
import StackedTableCell from "./StackedTableCell";
import StatusChip from "./StatusChip";
import getBookingStatus from "../../hooks/getBookingStatus";

interface Props {
  booking: BookingRow;
  isAdminView: boolean;
  isUserView: boolean;
  setModalData: (x: BookingRow) => void;
}

export default function BookingTableRow({
  booking,
  isAdminView,
  isUserView,
  setModalData,
}: Props) {
  const { bookingStatuses } = useContext(DatabaseContext);
  const titleRef = useRef();

  const [optimisticStatus, setOptimisticStatus] =
    useState<BookingStatusLabel>();

  const status = useMemo(
    () => getBookingStatus(booking, bookingStatuses),
    [booking, bookingStatuses, optimisticStatus]
  );

  return (
    <TableRow>
      <TableCell>{booking.requestNumber ?? "--"}</TableCell>
      <TableCell>
        <StatusChip status={optimisticStatus ?? status} />
      </TableCell>
      <StackedTableCell
        topText={formatDateTable(booking.startDate.toDate())}
        bottomText={`${formatTimeTable(booking.startDate.toDate())} - ${formatTimeTable(
          booking.endDate.toDate()
        )}`}
      />
      <TableCell sx={{ maxWidth: "150px" }}>{booking.roomId}</TableCell>
      {!isUserView && (
        <StackedTableCell
          topText={booking.department}
          bottomText={booking.role}
        />
      )}
      {!isUserView && (
        <StackedTableCell
          topText={booking.netId}
          bottomText={`${booking.firstName} ${booking.lastName}`}
        />
      )}
      {!isUserView && (
        <StackedTableCell
          topText={booking.email}
          bottomText={booking.phoneNumber}
        />
      )}
      <Tooltip
        title={booking.title}
        placement="bottom"
        slotProps={{
          popper: {
            sx: {
              [`&.${tooltipClasses.popper}[data-popper-placement*="bottom"] .${tooltipClasses.tooltip}`]:
                {
                  marginTop: "-12px",
                },
              [`&.${tooltipClasses.popper}[data-popper-placement*="top"] .${tooltipClasses.tooltip}`]:
                {
                  marginBottom: "-12px",
                },
            },
          },
        }}
      >
        <TableCell
          sx={{
            maxWidth: "200px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          <p ref={titleRef}>{booking.title}</p>
        </TableCell>
      </Tooltip>
      <TableCell>
        <IconButton onClick={() => setModalData(booking)}>
          <MoreHoriz />
        </IconButton>
      </TableCell>
      <TableCell width={100}>
        <BookingActions
          status={optimisticStatus ?? status}
          calendarEventId={booking.calendarEventId}
          {...{ setOptimisticStatus, isAdminView, isUserView }}
        />
      </TableCell>
    </TableRow>
  );
}
