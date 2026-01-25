import {
  IconButton,
  TableCell,
  TableRow,
  Tooltip,
  tooltipClasses,
  useTheme,
} from "@mui/material";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookingRow,
  BookingStatusLabel,
  PageContextLevel,
} from "../../../../types";
import { formatDateTable, formatTimeAmPm } from "../../../utils/date";

import MoreHoriz from "@mui/icons-material/MoreHoriz";
import BookingActions from "../../admin/components/BookingActions";
import getBookingStatus from "../../hooks/getBookingStatus";
import EquipmentCheckoutToggle from "./EquipmentCheckoutToggle";
import StackedTableCell from "./StackedTableCell";
import StatusChip from "./StatusChip";

interface Props {
  booking: BookingRow;
  calendarEventId?: string;
  pageContext: PageContextLevel;
  setModalData: (x: BookingRow) => void;
}

export default function BookingTableRow({
  booking,
  calendarEventId,
  pageContext,
  setModalData,
}: Props) {
  const titleRef = useRef();
  const theme = useTheme();
  const params = useParams();
  const tenant = params?.tenant as string;
  const [isHighlight, setHighlight] = useState(
    calendarEventId && calendarEventId === booking.calendarEventId
  );

  const isUserView = pageContext === PageContextLevel.USER;

  const [optimisticStatus, setOptimisticStatus] =
    useState<BookingStatusLabel>();

  const actualStatus = useMemo(() => {
    return getBookingStatus(booking, tenant);
  }, [booking, tenant]);

  const displayStatus = useMemo(() => {
    if (optimisticStatus) {
      return optimisticStatus;
    }
    return actualStatus;
  }, [optimisticStatus, actualStatus]);

  useEffect(() => {
    if (optimisticStatus && optimisticStatus === actualStatus) {
      setOptimisticStatus(undefined);
    }
  }, [optimisticStatus, actualStatus]);

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
        <StatusChip status={displayStatus} allowTooltip={true} />
      </TableCell>
      <StackedTableCell
        topText={formatDateTable(booking.startDate.toDate())}
        bottomText={`${formatTimeAmPm(booking.startDate.toDate())} - ${formatTimeAmPm(
          booking.endDate.toDate()
        )} ET`}
      />
      <TableCell sx={{ maxWidth: "150px" }}>{booking.roomId}</TableCell>
      {!isUserView && (
        <StackedTableCell
          topText={
            booking.otherDepartment
              ? `${booking.department} - ${booking.otherDepartment}`
              : booking.department
          }
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
      {!isUserView && (
        <TableCell>
          <EquipmentCheckoutToggle
            status={booking.equipmentCheckedOut}
            {...{ booking }}
          />
        </TableCell>
      )}
      <TableCell width={100}>
        <BookingActions
          status={actualStatus}
          calendarEventId={booking.calendarEventId}
          startDate={booking.startDate}
          onSelect={() => setHighlight(false)}
          {...{ setOptimisticStatus, pageContext }}
        />
      </TableCell>
    </TableRow>
  );
}
