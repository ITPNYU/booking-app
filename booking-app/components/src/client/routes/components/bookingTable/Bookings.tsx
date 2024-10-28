import { Booking, BookingRow, PageContextLevel } from "../../../../types";
import { Box, TableCell } from "@mui/material";
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import Table, { TableEmpty } from "../Table";

import BookMoreButton from "./BookMoreButton";
import BookingTableFilters from "./BookingTableFilters";
import BookingTableRow from "./BookingTableRow";
import { ColumnSortOrder } from "./hooks/getColumnComparator";
import { DatabaseContext } from "../Provider";
import { DateRangeFilter } from "./hooks/getDateFilter";
import Loading from "../Loading";
import MoreInfoModal from "./MoreInfoModal";
import SortableTableCell from "./SortableTableCell";
import useAllowedStatuses from "./hooks/useAllowedStatuses";
import { useBookingFilters } from "./hooks/useBookingFilters";

interface BookingsProps {
  pageContext: PageContextLevel;
}

export const Bookings: React.FC<BookingsProps> = ({ pageContext }) => {
  const { bookings, bookingsLoading, reloadBookings } =
    useContext(DatabaseContext);
  const allowedStatuses = useAllowedStatuses(pageContext);

  const [modalData, setModalData] = useState<BookingRow>(null);
  const [statusFilters, setStatusFilters] = useState([]);
  const [selectedDateRange, setSelectedDateRange] =
    useState<DateRangeFilter>("Today");
  const [orderBy, setOrderBy] = useState<keyof BookingRow>("startDate");
  const [order, setOrder] = useState<ColumnSortOrder>("asc");

  const isUserView = pageContext === PageContextLevel.USER;

  useEffect(() => {
    reloadBookings();
  }, []);

  const filteredRows = useBookingFilters({
    pageContext,
    columnOrderBy: orderBy,
    columnOrder: order,
    selectedDateRange,
    selectedStatusFilters: statusFilters,
  });

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
