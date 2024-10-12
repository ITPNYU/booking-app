import {
  Booking,
  BookingRow,
  BookingStatusLabel,
  PageContextLevel,
} from "../../../../types";
import BookingTableFilters, {
  DATE_FILTERS,
  DateRangeFilter,
} from "./BookingTableFilters";
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
import BookingTableRow from "./BookingTableRow";
import { DatabaseContext } from "../Provider";
import Loading from "../Loading";
import MoreInfoModal from "./MoreInfoModal";
import getBookingStatus from "../../hooks/getBookingStatus";

interface BookingsProps {
  pageContext: PageContextLevel;
}

export const Bookings: React.FC<BookingsProps> = ({ pageContext }) => {
  const { bookings, bookingsLoading, liaisonUsers, userEmail, reloadBookings } =
    useContext(DatabaseContext);

  const [modalData, setModalData] = useState<BookingRow>(null);
  const [statusFilters, setStatusFilters] = useState([]);
  const [selectedDateRange, setSelectedDateRange] =
    useState<DateRangeFilter>("today");
  const [orderBy, setOrderBy] = useState<keyof BookingRow>("startDate");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [currentTime, setCurrentTime] = useState(new Date());

  const isUserView = pageContext === PageContextLevel.USER;

  useEffect(() => {
    reloadBookings();
  }, []);

  const rows: BookingRow[] = useMemo(
    () =>
      bookings.map((booking) => ({
        ...booking,
        status: getBookingStatus(booking),
      })),
    [bookings]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const allowedStatuses: BookingStatusLabel[] = useMemo(() => {
    if (pageContext === PageContextLevel.PA) {
      return [
        BookingStatusLabel.APPROVED,
        BookingStatusLabel.CHECKED_IN,
        BookingStatusLabel.CHECKED_OUT,
        BookingStatusLabel.NO_SHOW,
        BookingStatusLabel.WALK_IN,
      ];
    } else if (pageContext === PageContextLevel.LIAISON) {
      return [BookingStatusLabel.REQUESTED];
    } else {
      return Object.values(BookingStatusLabel);
    }
  }, [pageContext]);

  const filteredRows = useMemo(() => {
    let filtered: BookingRow[] = rows;

    // filter if endTime has passed and status is NO_SHOW or CHECKED_OUT
    const elapsedStatues = [
      BookingStatusLabel.NO_SHOW,
      BookingStatusLabel.CHECKED_OUT,
      BookingStatusLabel.CANCELED,
    ];
    // checks once per minute
    filtered = filtered.filter(
      (row) =>
        !(
          elapsedStatues.includes(row.status) &&
          row.endDate.toDate() < currentTime
        )
    );

    // filter based on user view
    if (pageContext === PageContextLevel.USER) {
      filtered = rows.filter((row) => row.email === userEmail);
    } else if (pageContext === PageContextLevel.LIAISON) {
      const liaisonMatches = liaisonUsers.filter(
        (user) => user.email === userEmail
      );
      if (liaisonMatches.length > 0) {
        const liaisonDepartments = liaisonMatches.map(
          (user) => user.department
        );
        filtered = rows.filter((row) =>
          liaisonDepartments.includes(row.department)
        );
      }
    }

    filtered = filtered.filter((row) => allowedStatuses.includes(row.status));

    if (pageContext >= PageContextLevel.PA) {
      // PA and Admin
      // filter by selected PA date range
      filtered = filtered.filter(DATE_FILTERS[selectedDateRange]);
    }

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
    pageContext,
    rows,
    allowedStatuses,
    statusFilters,
    order,
    orderBy,
    currentTime,
    selectedDateRange,
  ]);

  const topRow = useMemo(() => {
    if (pageContext === PageContextLevel.USER) {
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

    if (pageContext === PageContextLevel.LIAISON) {
      return (
        <Box
          sx={{
            color: "rgba(0,0,0,0.6)",
            display: "flex",
            justifyContent: "flex-start",
            paddingLeft: "16px",
          }}
        >
          Department Requests
        </Box>
      );
    }

    return (
      <BookingTableFilters
        selectedStatuses={statusFilters}
        setSelectedStatuses={setStatusFilters}
        {...{
          allowedStatuses,
          pageContext,
          selectedDateRange,
          setSelectedDateRange,
        }}
      />
    );
  }, [pageContext, statusFilters, allowedStatuses, selectedDateRange]);

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
          {pageContext === PageContextLevel.USER
            ? "You don't have any reservations"
            : "No active reservations found"}
        </TableEmpty>
      );
    }
  }, [pageContext, bookingsLoading, filteredRows]);

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
      !isUserView && <TableCell key="equip">Equip.</TableCell>,
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
              pageContext,
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
