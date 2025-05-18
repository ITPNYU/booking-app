import {
  Approver,
  BookingRow,
  BookingStatusLabel,
  PageContextLevel,
} from "@/components/src/types";
import { useContext, useEffect, useMemo, useState } from "react";
import { COMPARATORS, ColumnSortOrder } from "./getColumnComparator";
import { DATE_FILTERS, DateRangeFilter } from "./getDateFilter";

import { BOOKING_TABLE_HIDE_STATUS_TIME_ELAPSED } from "@/components/src/policy";
import getBookingStatus from "../../../hooks/getBookingStatus";
import { DatabaseContext } from "../../Provider";
import useAllowedStatuses from "./useAllowedStatuses";

interface Props {
  pageContext: PageContextLevel;
  columnOrderBy: keyof BookingRow;
  columnOrder: ColumnSortOrder;
  selectedDateRange: DateRangeFilter;
  selectedStatusFilters: BookingStatusLabel[];
  searchQuery?: string;
}

function getDateRangeFromDateSelection(selectedDateRange: DateRangeFilter) {
  switch (selectedDateRange) {
    case "Today": {
      // return an array of the start and end of the day
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      return [startOfDay, endOfDay];
    }
    case "This Week": {
      // return an array of the start and end of the week
      const today = new Date();
      let dayOfWeek = today.getDay();
      if (dayOfWeek === 0) {
        // sunday as last day of week
        dayOfWeek = 7;
      }

      // Calculate the start of the week (Monday)
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - (dayOfWeek - 1));
      startOfWeek.setHours(0, 0, 0, 0);

      // Calculate the end of the week (Sunday)
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + (7 - dayOfWeek));
      endOfWeek.setHours(23, 59, 59, 999);
      return [startOfWeek, endOfWeek];
    }
    case "All Future": {
      // return an array of the start of today and the end of time
      const today = new Date();
      const startOfToday = new Date(today);
      startOfToday.setHours(0, 0, 0, 0);
      return [startOfToday, null];
    }
    case "Past 24 hours": {
      // return an array of the start and end of the past 24 hours
      const today = new Date();
      const startOfPast24Hours = new Date(today);
      startOfPast24Hours.setHours(today.getHours() - 24);
      return [startOfPast24Hours, today];
    }
    case "Past Week": {
      // return an array of the start and end of the past week
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset today to midnight

      const startOfPastWeek = new Date(today);
      startOfPastWeek.setDate(today.getDate() - 7);
      return [startOfPastWeek, today];
    }
    case "Past Month": {
      // return an array of the start and end of the past month
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset today to midnight

      const startOfPastMonth = new Date(today);
      startOfPastMonth.setMonth(today.getMonth() - 1);
      return [startOfPastMonth, today];
    }
    case "Past 6 Months": {
      // return an array of the start and end of the past 6 months
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset today to midnight

      const startOfPast6Months = new Date(today);
      startOfPast6Months.setMonth(today.getMonth() - 6);
      return [startOfPast6Months, today];
    }
    case "Past 9 Months": {
      // return an array of the start of time and the end of today
      const today = new Date();
      const endOfToday = new Date(today);
      endOfToday.setHours(23, 59, 59, 999);

      const startOfPast9Months = new Date(today);
      startOfPast9Months.setMonth(today.getMonth() - 9);
      return [startOfPast9Months, endOfToday];
    }
    default:
      return "Today";
  }
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
    if (this.pageContext === PageContextLevel.USER) {
      this.rows = this.rows.filter(
        (row) =>
          !(
            BOOKING_TABLE_HIDE_STATUS_TIME_ELAPSED.includes(row.status) &&
            row.endDate.toDate() < currentTime
          )
      );
    }
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

  filterBySearchQuery(searchQuery: string) {
    if (searchQuery && searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase().trim();
      this.rows = this.rows.filter((row) => {
        return (
          // Search in request number
          (row.requestNumber && row.requestNumber.toString().includes(query)) ||
          // Search in department
          (row.department && row.department.toLowerCase().includes(query)) ||
          // Search in netId/email
          (row.netId && row.netId.toLowerCase().includes(query)) ||
          (row.email && row.email.toLowerCase().includes(query)) ||
          // Search in title
          (row.title && row.title.toLowerCase().includes(query)) ||
          // Search in description
          (row.description && row.description.toLowerCase().includes(query)) ||
          // Search in name
          (row.firstName && row.firstName.toLowerCase().includes(query)) ||
          (row.lastName && row.lastName.toLowerCase().includes(query)) ||
          // Search in roomId
          (row.roomId && row.roomId.toLowerCase().includes(query))
        );
      });
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

export function useBookingFilters(props: Props): BookingRow[] {
  const {
    pageContext,
    columnOrderBy,
    columnOrder,
    selectedDateRange,
    selectedStatusFilters,
    searchQuery = "",
  } = props;
  const { liaisonUsers, userEmail, allBookings, setFilters } =
    useContext(DatabaseContext);
  const allowedStatuses = useAllowedStatuses(pageContext);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    console.log(
      "selectedDateRange",
      getDateRangeFromDateSelection(selectedDateRange)
    );
    setFilters({
      dateRange: getDateRangeFromDateSelection(selectedDateRange),
      sortField: "startDate",
      searchQuery: searchQuery,
    });
  }, [selectedDateRange, setFilters, searchQuery]);

  const rows: BookingRow[] = useMemo(() => {
    return allBookings.map((booking) => ({
      ...booking,
      status: getBookingStatus(booking),
      id: booking.calendarEventId,
    }));
  }, [allBookings]);

  const filteredRows = useMemo(() => {
    const filter = new BookingFilter({
      rows,
      allowedStatuses,
      pageContext,
    });

    return (
      filter
        // .filterSelectedDateRange(selectedDateRange)
        .filterElapsedTime(currentTime)
        .filterPageContext(userEmail, liaisonUsers)
        .filterAllowedStatuses()
        .filterStatusChips(selectedStatusFilters)
        // No need for client-side search filtering since it's done on the database side
        // .filterBySearchQuery(searchQuery)
        .sortByColumn(columnOrderBy, columnOrder)
        .getRows()
    );
  }, [
    rows,
    columnOrderBy,
    columnOrder,
    currentTime,
    pageContext,
    // selectedDateRange,
    selectedStatusFilters,
    // searchQuery, // Removed as it's handled by the database
    userEmail,
    liaisonUsers,
    allowedStatuses,
  ]);

  return filteredRows;
}
