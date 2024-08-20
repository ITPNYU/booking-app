import { Booking, BookingRow, BookingStatusLabel } from "../../../../types";
import { Box, TableCell } from "@mui/material";
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import SortableTableCell, { COMPARATORS } from "./SortableTableCell";
import Table, { TableEmpty } from "../Table";

import BookMoreButton from "./BookMoreButton";
import BookingTableFilters from "./BookingTableFilters";
import BookingTableRow from "./BookingTableRow";
import { DatabaseContext } from "../Provider";
import Loading from "../Loading";
import MoreInfoModal from "./MoreInfoModal";
import getBookingStatus from "../../hooks/getBookingStatus";

interface BookingsProps {
  isAdminView?: boolean;
  isPaView?: boolean;
  isUserView?: boolean;
}

export const Bookings: React.FC<BookingsProps> = ({
  isAdminView = false,
  isPaView = false,
  isUserView = false,
}) => {
  const {
    bookings,
    bookingsLoading,
    bookingStatuses,
    userEmail,
    reloadBookings,
    reloadBookingStatuses,
  } = useContext(DatabaseContext);

  const [modalData, setModalData] = useState<BookingRow>(null);
  const [statusFilters, setStatusFilters] = useState([]);
  const [orderBy, setOrderBy] = useState<keyof BookingRow>("startDate");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    reloadBookingStatuses();
    reloadBookings();
  }, []);

  const rows: BookingRow[] = useMemo(
    () =>
      bookings.map((booking) => ({
        ...booking,
        status: getBookingStatus(booking, bookingStatuses),
      })),
    [bookings, bookingStatuses]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const allowedStatuses: BookingStatusLabel[] = useMemo(() => {
    const paViewStatuses = [
      BookingStatusLabel.APPROVED,
      BookingStatusLabel.CHECKED_IN,
      BookingStatusLabel.CHECKED_OUT,
      BookingStatusLabel.NO_SHOW,
      BookingStatusLabel.WALK_IN,
    ];
    if (isPaView) {
      return paViewStatuses;
    } else {
      return Object.values(BookingStatusLabel);
    }
  }, [isUserView, isPaView]);

  const filteredRows = useMemo(() => {
    let filtered: BookingRow[] = rows;
    // filter based on user view
    if (isUserView) filtered = rows.filter((row) => row.email === userEmail);
    else if (isPaView)
      filtered = rows.filter((row) => allowedStatuses.includes(row.status));

    // filter if endTime has passed and status is NO_SHOW or CHECKED_OUT
    const elapsedStatues = [
      BookingStatusLabel.NO_SHOW,
      BookingStatusLabel.CHECKED_OUT,
    ];
    // checks once per minute
    filtered = filtered.filter(
      (row) =>
        !(
          elapsedStatues.includes(row.status) &&
          row.endDate.toDate() < currentTime
        )
    );

    // column sorting
    const comparator = COMPARATORS[orderBy];
    const coeff = order === "asc" ? 1 : -1;
    comparator != null && filtered.sort((a, b) => coeff * comparator(a, b));

    // status chip filters
    if (statusFilters.length === 0) {
      return filtered;
    }
    return filtered.filter((row) => statusFilters.includes(row.status));
  }, [
    isUserView,
    isPaView,
    rows,
    allowedStatuses,
    statusFilters,
    order,
    orderBy,
    currentTime,
  ]);

  const topRow = useMemo(() => {
    if (isUserView) {
      return (
        <Box
          sx={{
            color: "rgba(0,0,0,0.6)",
            display: "flex",
            justifyContent: "flex-start",
            paddingLeft: "16px",
          }}
        >
          Your Bookings
        </Box>
      );
    }
    return (
      <BookingTableFilters
        allowedStatuses={allowedStatuses}
        selected={statusFilters}
        setSelected={setStatusFilters}
      />
    );
  }, [isUserView, statusFilters, allowedStatuses]);

  const bottomSection = useMemo(() => {
    if (bookingsLoading && bookings.length === 0) {
      return (
        <TableEmpty>
          <Loading />
        </TableEmpty>
      );
    }
    if (filteredRows.length === 0) {
      return (
        <TableEmpty>
          {isUserView
            ? "You don't have any reservations"
            : "No active reservations found"}
        </TableEmpty>
      );
    }
  }, [isUserView, bookingsLoading, filteredRows]);

  const createSortHandler = useCallback(
    (property: keyof Booking) => (_: React.MouseEvent<unknown>) => {
      const isAsc = orderBy === property && order === "asc";
      setOrder(isAsc ? "desc" : "asc");
      setOrderBy(property);
    },
    [order, orderBy]
  );

  const columns = useMemo(
    () => [
      <SortableTableCell
        label="#"
        property="requestNumber"
        key="requestNumber"
        {...{ createSortHandler, order, orderBy }}
      />,
      <SortableTableCell
        key="status"
        label="Status"
        property="status"
        {...{ createSortHandler, order, orderBy }}
      />,
      <SortableTableCell
        label="Date / Time"
        property="startDate"
        key="startDate"
        {...{ createSortHandler, order, orderBy }}
      />,
      <TableCell key="room">Room(s)</TableCell>,
      !isUserView && (
        <SortableTableCell
          label="Department / Role"
          property="department"
          key="department"
          {...{ createSortHandler, order, orderBy }}
        />
      ),
      !isUserView && (
        <SortableTableCell
          key="netId"
          label="Requestor"
          property="netId"
          {...{ createSortHandler, order, orderBy }}
        />
      ),
      !isUserView && <TableCell key="contacts">Contact Info</TableCell>,
      <TableCell key="title">Title</TableCell>,
      <TableCell key="other">Details</TableCell>,
      <TableCell key="action">Action</TableCell>,
    ],
    [isUserView, order, orderBy]
  );

  return (
    <Box sx={{ marginTop: 4 }}>
      <Table
        {...{ columns, topRow }}
        sx={{
          borderRadius: isUserView ? "0px" : "",
        }}
      >
        {filteredRows.map((row) => (
          <BookingTableRow
            key={row.calendarEventId}
            {...{
              booking: row,
              isAdminView,
              isUserView,
              setModalData,
            }}
          />
        ))}
      </Table>
      {isUserView && <BookMoreButton />}
      {bottomSection}
      {modalData != null && (
        <MoreInfoModal
          booking={modalData}
          closeModal={() => setModalData(null)}
        />
      )}
    </Box>
  );
};
