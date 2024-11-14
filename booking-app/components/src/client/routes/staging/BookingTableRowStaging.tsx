import { BookingStatusLabel, PageContextLevel } from "@/components/src/types";
import {
  IconButton,
  TableCell,
  TableRow,
  Tooltip,
  tooltipClasses,
  useTheme,
} from "@mui/material";
import { formatDateTable, formatTimeAmPm } from "../../utils/date";
import { useMemo, useRef, useState } from "react";

import BookingActions from "../admin/components/BookingActions";
import { BookingRowStaging } from "@/components/src/typesStaging";
import { MoreHoriz } from "@mui/icons-material";
import StackedTableCell from "../components/bookingTable/StackedTableCell";
import StatusChip from "../components/bookingTable/StatusChip";
import getBookingStatus from "../hooks/getBookingStatus";

interface Props {
  booking: BookingRowStaging;
  calendarEventId?: string;
  pageContext: PageContextLevel;
  setModalData: (x: BookingRowStaging) => void;
}

export default function BookingTableRowStaging({
  booking,
  calendarEventId,
  pageContext,
  setModalData,
}: Props) {
  const titleRef = useRef();
  const theme = useTheme();
  const [isHighlight, setHighlight] = useState(
    calendarEventId && calendarEventId === booking.calendarEventId
  );

  const isUserView = pageContext === PageContextLevel.USER;

  const [optimisticStatus, setOptimisticStatus] =
    useState<BookingStatusLabel>();

  const status = useMemo(
    () => getBookingStatus(booking),
    [booking, optimisticStatus]
  );

  return (
    <TableRow
      sx={
        isHighlight
          ? {
              backgroundColor: theme.palette.secondary.light,
            }
          : {}
      }
    >
      <TableCell>{booking.requestNumber ?? "--"}</TableCell>
      <TableCell>
        <StatusChip status={optimisticStatus ?? status} allowTooltip={true} />
      </TableCell>
      <StackedTableCell
        topText={formatDateTable(booking.startDate.toDate())}
        bottomText={`${formatTimeAmPm(booking.startDate.toDate())} - ${formatTimeAmPm(
          booking.endDate.toDate()
        )}`}
      />
      <TableCell sx={{ maxWidth: "150px" }}>{booking.roomId}</TableCell>
      {!isUserView && (
        <StackedTableCell
          topText={booking.netId}
          bottomText={`${booking.firstName} ${booking.lastName}`}
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
          startDate={booking.startDate}
          onSelect={() => setHighlight(false)}
          {...{ setOptimisticStatus, pageContext }}
        />
      </TableCell>
    </TableRow>
  );
}
