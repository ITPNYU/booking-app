import React, { useContext, useEffect, useMemo, useState } from "react";
import Table, { TableEmpty } from "../Table";

import BookMoreButton from "./BookMoreButton";
import BookingTableFilters from "./BookingTableFilters";
import { Box } from "@mui/material";
import { DateRangeFilter } from "./hooks/getDateFilter";
import Loading from "../Loading";
import MoreInfoModal from "./MoreInfoModal";
import { PageContextLevel } from "../../../../types";
import { SharedDatabaseContext } from "../../../providers/SharedDatabaseProvider";
import { Tenants } from "@/components/src/policy";
import useAllowedStatuses from "./hooks/useAllowedStatuses";
import useBookingTableMediaCommons from "../../mediaCommons/useBookingTableMediaCommons";
import useBookingTableStaging from "../../staging/useBookingTableStaging";
import useBookings from "./hooks/useBookings";

interface BookingsProps {
  pageContext: PageContextLevel;
  calendarEventId?: string;
  tenant: Tenants;
}

export const Bookings: React.FC<BookingsProps> = ({
  pageContext,
  calendarEventId,
  tenant,
}) => {
  const { bookingsLoading, reloadBookings } = useContext(SharedDatabaseContext);
  const bookings = useBookings();
  const allowedStatuses = useAllowedStatuses(pageContext);

  const [statusFilters, setStatusFilters] = useState([]);
  const [selectedDateRange, setSelectedDateRange] = useState<DateRangeFilter>(
    calendarEventId ? "All" : "Today"
  );

  const isUserView = pageContext === PageContextLevel.USER;

  const mediaCommonsData = useBookingTableMediaCommons({
    pageContext,
    calendarEventId,
    selectedStatusFilters: statusFilters,
    selectedDateRange,
  });

  const stagingData = useBookingTableStaging({
    pageContext,
    calendarEventId,
    selectedStatusFilters: statusFilters,
    selectedDateRange,
  });

  const { rows, columns, modalData, setModalData } = (() => {
    switch (tenant) {
      case Tenants.MEDIA_COMMONS:
        return mediaCommonsData;
      case Tenants.STAGING:
        return stagingData;
    }
  })();

  useEffect(() => {
    reloadBookings();
  }, []);

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
    if (rows.length === 0) {
      return (
        <TableEmpty>
          {pageContext === PageContextLevel.USER
            ? "You don't have any reservations"
            : "No active reservations found"}
        </TableEmpty>
      );
    }
  }, [pageContext, bookingsLoading, rows]);

  return (
    <Box sx={{ marginTop: 4 }}>
      <Table
        {...{ columns, topRow }}
        sx={{
          borderRadius: isUserView ? "0px" : "",
        }}
      >
        {rows}
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
