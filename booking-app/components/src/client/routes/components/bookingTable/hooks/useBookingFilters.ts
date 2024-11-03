import {
  Approver,
  BookingRow,
  BookingStatusLabel,
  PageContextLevel,
} from "@/components/src/types";
import { COMPARATORS, ColumnSortOrder } from "./getColumnComparator";
import { DATE_FILTERS, DateRangeFilter } from "./getDateFilter";
import { useContext, useEffect, useMemo, useState } from "react";

import { BOOKING_TABLE_HIDE_STATUS_TIME_ELAPSED } from "@/components/src/policy";
import { DatabaseContext } from "../../Provider";
import getBookingStatus from "../../../hooks/getBookingStatus";
import useAllowedStatuses from "./useAllowedStatuses";
import { useAuth } from "../../AuthProvider";

interface Props {
  pageContext: PageContextLevel;
  columnOrderBy: keyof BookingRow;
  columnOrder: ColumnSortOrder;
  selectedDateRange: DateRangeFilter;
  selectedStatusFilters: BookingStatusLabel[];
}

export function useBookingFilters(props: Props): BookingRow[] {
  const {
    pageContext,
    columnOrderBy,
    columnOrder,
    selectedDateRange,
    selectedStatusFilters,
  } = props;
  const { bookings, liaisonUsers } = useContext(DatabaseContext);
  const { userEmail } = useAuth();
  const allowedStatuses = useAllowedStatuses(pageContext);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const rows: BookingRow[] = useMemo(
    () =>
      bookings.map((booking) => ({
        ...booking,
        status: getBookingStatus(booking),
      })),
    [bookings]
  );

  const filteredRows = useMemo(() => {
    const filter = new BookingFilter({
      rows,
      allowedStatuses,
      pageContext,
    });

    return filter
      .filterSelectedDateRange(selectedDateRange)
      .filterElapsedTime(currentTime)
      .filterPageContext(userEmail, liaisonUsers)
      .filterAllowedStatuses()
      .filterStatusChips(selectedStatusFilters)
      .sortByColumn(columnOrderBy, columnOrder)
      .getRows();
  }, [
    rows,
    columnOrderBy,
    columnOrder,
    currentTime,
    pageContext,
    selectedDateRange,
    selectedStatusFilters,
  ]);

  return filteredRows;
}

class BookingFilter {
  rows: BookingRow[];
  allowedStatuses: BookingStatusLabel[];
  pageContext: PageContextLevel;

  constructor(obj: {
    rows: BookingRow[];
    allowedStatuses: BookingStatusLabel[];
    pageContext: PageContextLevel;
  }) {
    this.rows = obj.rows;
    this.allowedStatuses = obj.allowedStatuses;
    this.pageContext = obj.pageContext;
  }

  // filter if endTime has passed and status should be hidden
  // checks once per minute
  filterElapsedTime(currentTime: Date) {
    this.rows = this.rows.filter(
      (row) =>
        !(
          BOOKING_TABLE_HIDE_STATUS_TIME_ELAPSED.includes(row.status) &&
          row.endDate.toDate() < currentTime
        )
    );
    return this;
  }

  filterPageContext(userEmail: string, liaisonUsers: Approver[]) {
    if (this.pageContext === PageContextLevel.USER) {
      this.rows = this.rows.filter((row) => row.email === userEmail);
    }
    if (this.pageContext === PageContextLevel.LIAISON) {
      const liaisonMatches = liaisonUsers.filter(
        (user) => user.email === userEmail
      );
      if (liaisonMatches.length > 0) {
        const liaisonDepartments = liaisonMatches.map(
          (user) => user.department
        );
        this.rows = this.rows.filter((row) =>
          liaisonDepartments.includes(row.department)
        );
      }
    }
    return this;
  }

  filterAllowedStatuses() {
    this.rows = this.rows.filter((row) =>
      this.allowedStatuses.includes(row.status)
    );
    return this;
  }

  filterSelectedDateRange(selectedDateRange: DateRangeFilter) {
    if (this.pageContext >= PageContextLevel.PA) {
      this.rows = this.rows.filter(DATE_FILTERS[selectedDateRange]);
    }
    return this;
  }

  filterStatusChips(selectedStatusFilters: BookingStatusLabel[]) {
    if (selectedStatusFilters.length > 0) {
      this.rows = this.rows.filter((row) =>
        selectedStatusFilters.includes(row.status)
      );
    }
    return this;
  }

  sortByColumn(orderBy: keyof BookingRow, order: ColumnSortOrder) {
    const comparator = COMPARATORS[orderBy];
    const coeff = order === "asc" ? 1 : -1;
    if (comparator != null) {
      this.rows.sort((a, b) => coeff * comparator(a, b));
    }

    return this;
  }

  getRows() {
    return this.rows;
  }
}
