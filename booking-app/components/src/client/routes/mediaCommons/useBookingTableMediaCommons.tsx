import {
  BookingMediaCommons,
  BookingRowMediaCommons,
} from "@/components/src/typesMediaCommons";
import { BookingStatusLabel, PageContextLevel } from "@/components/src/types";
import { useCallback, useState } from "react";

import BookingTableColumnsMediaCommons from "./BookingTableColumnsMediaCommons";
import BookingTableRowMediaCommons from "./BookingTableRowMediaCommons";
import { ColumnSortOrder } from "../components/bookingTable/hooks/getColumnComparator";
import { DateRangeFilter } from "../components/bookingTable/hooks/getDateFilter";
import { useBookingFilters } from "../components/bookingTable/hooks/useBookingFilters";
import { useMediaCommonsDatabase } from "../../providers/MediaCommonsDatabaseProvider";

interface Props {
  calendarEventId?: string;
  pageContext: PageContextLevel;
  selectedDateRange: DateRangeFilter;
  selectedStatusFilters: BookingStatusLabel[];
}

export default function useBookingTableMediaCommons(props: Props) {
  const {
    calendarEventId,
    pageContext,
    selectedDateRange,
    selectedStatusFilters,
  } = props;
  const { bookings } = useMediaCommonsDatabase();

  const [modalData, setModalData] = useState<BookingRowMediaCommons>(null);

  const [orderBy, setOrderBy] =
    useState<keyof BookingRowMediaCommons>("startDate");
  const [order, setOrder] = useState<ColumnSortOrder>("asc");

  const isUserView = pageContext === PageContextLevel.USER;

  const createSortHandler = useCallback(
    (property: keyof BookingMediaCommons) => (_: React.MouseEvent<unknown>) => {
      const isAsc = orderBy === property && order === "asc";
      setOrder(isAsc ? "desc" : "asc");
      setOrderBy(property);
    },
    [order, orderBy]
  );

  const filteredRows = useBookingFilters({
    bookings,
    pageContext,
    columnOrderBy: orderBy,
    columnOrder: order,
    selectedDateRange,
    selectedStatusFilters,
  });

  const rows = filteredRows.map((row) => (
    <BookingTableRowMediaCommons
      key={row.calendarEventId}
      {...{
        booking: row as unknown as BookingRowMediaCommons,
        calendarEventId,
        pageContext,
        isUserView,
        setModalData,
      }}
    />
  ));

  const columns = [
    ...BookingTableColumnsMediaCommons({
      pageContext,
      createSortHandler,
      order,
      orderBy,
    }),
  ];

  return { rows, columns, modalData, setModalData };
}
