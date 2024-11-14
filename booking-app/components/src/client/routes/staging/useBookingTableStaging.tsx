import {
  BookingRowStaging,
  BookingStaging,
} from "@/components/src/typesStaging";
import { BookingStatusLabel, PageContextLevel } from "@/components/src/types";
import { useCallback, useState } from "react";

import BookingTableColumnsStaging from "./BookingTableColumnsStaging";
import BookingTableRowStaging from "./BookingTableRowStaging";
import { ColumnSortOrder } from "../components/bookingTable/hooks/getColumnComparator";
import { DateRangeFilter } from "../components/bookingTable/hooks/getDateFilter";
import { useBookingFilters } from "../components/bookingTable/hooks/useBookingFilters";
import { useStagingDatabase } from "../../providers/StagingDatabaseProvider";

interface Props {
  calendarEventId?: string;
  pageContext: PageContextLevel;
  selectedDateRange: DateRangeFilter;
  selectedStatusFilters: BookingStatusLabel[];
}

export default function useBookingTableStaging(props: Props) {
  const {
    calendarEventId,
    pageContext,
    selectedDateRange,
    selectedStatusFilters,
  } = props;
  const { bookings } = useStagingDatabase();

  const [modalData, setModalData] = useState<BookingRowStaging>(null);

  const [orderBy, setOrderBy] = useState<keyof BookingRowStaging>("startDate");
  const [order, setOrder] = useState<ColumnSortOrder>("asc");

  const isUserView = pageContext === PageContextLevel.USER;

  const createSortHandler = useCallback(
    (property: keyof BookingStaging) => (_: React.MouseEvent<unknown>) => {
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
    <BookingTableRowStaging
      key={row.calendarEventId}
      {...{
        booking: row as unknown as BookingRowStaging,
        calendarEventId,
        pageContext,
        isUserView,
        setModalData,
      }}
    />
  ));

  const columns = [
    ...BookingTableColumnsStaging({
      pageContext,
      createSortHandler,
      order,
      orderBy,
    }),
  ];

  return { rows, columns, modalData, setModalData };
}
