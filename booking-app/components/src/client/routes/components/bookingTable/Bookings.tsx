import { BookingRow, PageContextLevel } from "../../../../types";
import { Box, TableCell, IconButton } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import StackedTableCell from "./StackedTableCell";
import React, { useContext, useEffect, useMemo, useState } from "react";
import { TableEmpty } from "../Table";
import { MoreHoriz } from "@mui/icons-material";
import { Tooltip, tooltipClasses } from "@mui/material";

import BookMoreButton from "./BookMoreButton";
import BookingTableFilters from "./BookingTableFilters";
import { DatabaseContext } from "../Provider";
import { DateRangeFilter } from "./hooks/getDateFilter";
import Loading from "../Loading";
import MoreInfoModal from "./MoreInfoModal";
import useAllowedStatuses from "./hooks/useAllowedStatuses";
import { useBookingFilters } from "./hooks/useBookingFilters";
import StatusChip from "./StatusChip";
import EquipmentCheckoutToggle from "./EquipmentCheckoutToggle";
import BookingActions from "../../admin/components/BookingActions";
import { formatDateTable, formatTimeAmPm } from "../../../utils/date";
import getBookingStatus from "../../hooks/getBookingStatus";

interface BookingsProps {
  pageContext: PageContextLevel;
  calendarEventId?: string;
}

export const Bookings: React.FC<BookingsProps> = ({
  pageContext,
  calendarEventId,
}) => {
  const {
    bookingsLoading,
    setLastItem,
    fetchAllBookings,
    allBookings,
    loadMoreEnabled,
  } = useContext(DatabaseContext);
  const allowedStatuses = useAllowedStatuses(pageContext);

  const [modalData, setModalData] = useState<BookingRow>(null);
  const [statusFilters, setStatusFilters] = useState([]);
  const [selectedDateRange, setSelectedDateRange] =
    useState<DateRangeFilter>("All Future");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const isUserView = pageContext === PageContextLevel.USER;

  useEffect(() => {
    if (pageContext > PageContextLevel.LIAISON) {
      setSelectedDateRange("Today");
    }
    return () => {
      setLastItem(null);
    };
  }, []);

  useEffect(() => {
    if (fetchAllBookings && searchQuery !== undefined) {
      const isActualSearch = searchQuery.trim() !== "";
      if (isActualSearch) {
        setIsSearching(true);
        const timer = setTimeout(() => {
          if (!bookingsLoading) {
            setIsSearching(false);
          }
        }, 500);
        return () => clearTimeout(timer);
      } else {
        setIsSearching(false);
      }
    }
  }, [searchQuery, bookingsLoading]);

  const filteredRows = useBookingFilters({
    pageContext,
    columnOrderBy: "startDate",
    columnOrder: "asc",
    selectedDateRange,
    selectedStatusFilters: statusFilters,
    searchQuery,
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
          searchQuery,
          setSearchQuery,
          isSearching,
        }}
      />
    );
  }, [
    pageContext,
    statusFilters,
    allowedStatuses,
    selectedDateRange,
    searchQuery,
    isSearching,
  ]);

  const bottomSection = useMemo(() => {
    if (bookingsLoading && allBookings.length === 0) {
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
  }, [pageContext, bookingsLoading, filteredRows, allBookings.length]);

  const columns = useMemo(
    () =>
      [
        {
          field: "origin",
          headerName: "#",
          width: 60,
          renderHeader: () => <TableCell>Origin</TableCell>,
          renderCell: (params) => <TableCell></TableCell>, // TODO
        },
        {
          field: "requestNumber",
          headerName: "#",
          width: 80,
          renderHeader: () => <TableCell>#</TableCell>,
          renderCell: (params) => (
            <TableCell>{params.row.requestNumber ?? "--"}</TableCell>
          ),
        },
        {
          field: "status",
          headerName: "Status",
          width: 100,
          renderHeader: () => <TableCell>Status</TableCell>,
          renderCell: (params) => (
            <TableCell>
              <StatusChip
                status={getBookingStatus(params.row)}
                allowTooltip={true}
              />
            </TableCell>
          ),
        },
        {
          field: "startDate",
          headerName: "Date / Time",
          width: 130,
          renderHeader: () => <TableCell>Date / Time</TableCell>,
          renderCell: (params) => (
            <StackedTableCell
              topText={formatDateTable(params.row.startDate.toDate())}
              bottomText={`${formatTimeAmPm(params.row.startDate.toDate())} - ${formatTimeAmPm(
                params.row.endDate.toDate()
              )}`}
            />
          ),
        },
        {
          field: "room",
          headerName: "Room(s)",
          width: 100,
          renderHeader: () => <TableCell>Room(s)</TableCell>,
          renderCell: (params) => (
            <TableCell sx={{ maxWidth: "150px" }}>
              {params.row.roomId}
            </TableCell>
          ),
        },
        ...(!isUserView
          ? [
              {
                field: "department",
                headerName: "Department / Role",
                width: 150,
                renderHeader: () => <TableCell>Department / Role</TableCell>,
                renderCell: (params) => (
                  <StackedTableCell
                    topText={
                      params.row.otherDepartment
                        ? `${params.row.department} - ${params.row.otherDepartment}`
                        : params.row.department
                    }
                    bottomText={params.row.role}
                  />
                ),
              },
              {
                field: "netId",
                headerName: "Requestor",
                width: 100,
                renderHeader: () => <TableCell>Requestor</TableCell>,
                renderCell: (params) => (
                  <StackedTableCell
                    topText={params.row.netId}
                    bottomText={`${params.row.firstName} ${params.row.lastName}`}
                  />
                ),
              },
              {
                field: "contacts",
                headerName: "Contact Info",
                width: 180,
                renderHeader: () => <TableCell>Contact Info</TableCell>,
                renderCell: (params) => (
                  <StackedTableCell
                    topText={params.row.email}
                    bottomText={params.row.phoneNumber}
                  />
                ),
              },
            ]
          : []),
        {
          field: "title",
          headerName: "Title",
          width: 200,
          renderHeader: () => <TableCell>Title</TableCell>,
          renderCell: (params) => (
            <Tooltip
              title={params.row.title}
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
                {params.row.title}
              </TableCell>
            </Tooltip>
          ),
        },
        {
          field: "other",
          headerName: "Details",
          width: 80,
          renderHeader: () => <TableCell>Details</TableCell>,
          filterable: false,
          renderCell: (params) => (
            <TableCell>
              <IconButton onClick={() => setModalData(params.row)}>
                <MoreHoriz />
              </IconButton>
            </TableCell>
          ),
        },
        ...(!isUserView
          ? [
              {
                field: "equip",
                headerName: "Equip.",
                width: 80,
                renderHeader: () => <TableCell>Equip.</TableCell>,
                filterable: false,
                renderCell: (params) => (
                  <TableCell>
                    <EquipmentCheckoutToggle
                      status={params.row.equipmentCheckedOut}
                      booking={params.row}
                    />
                  </TableCell>
                ),
              },
            ]
          : []),
        {
          field: "action",
          headerName: "Action",
          width: 200,
          renderHeader: () => <TableCell>Action</TableCell>,
          filterable: false,
          renderCell: (params) => (
            <TableCell width={200}>
              <BookingActions
                status={getBookingStatus(params.row)}
                calendarEventId={params.row.calendarEventId}
                startDate={params.row.startDate}
                onSelect={() => {}}
                setOptimisticStatus={() => {}}
                pageContext={pageContext}
              />
            </TableCell>
          ),
        },
      ].filter(Boolean),
    [isUserView, pageContext]
  );

  return (
    <Box sx={{ marginTop: 4 }}>
      <DataGrid
        rows={filteredRows}
        columns={columns}
        getRowId={(row) => row.calendarEventId}
        hideFooterPagination={true}
        hideFooter={true}
        checkboxSelection={false}
        disableRowSelectionOnClick
        slots={{
          toolbar: () => (
            <div
              style={{
                padding: "10px 0",
                borderBottom: "1px solid rgba(224, 224, 224, 1)",
              }}
            >
              {topRow}
            </div>
          ),
        }}
        sx={{
          "& .MuiTableCell-root": {
            border: "none",
            padding: "0px",
          },
          "& .MuiDataGrid-cell": {
            display: "flex",
            alignItems: "center",
          },
          "& .MuiDataGrid-row--borderBottom": {
            backgroundColor: "#EEEEEE !important",
          },
        }}
      />
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
