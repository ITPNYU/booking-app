import { MoreHoriz } from "@mui/icons-material";
import {
  Box,
  IconButton,
  TableCell,
  Tooltip,
  tooltipClasses,
} from "@mui/material";
import { DataGrid, GridSortModel } from "@mui/x-data-grid";
import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  BookingRow,
  BookingStatusLabel,
  PageContextLevel,
} from "../../../../types";
import { TableEmpty } from "../Table";
import StackedTableCell from "./StackedTableCell";

import { formatDateTable, formatTimeAmPm } from "../../../utils/date";
import BookingActions from "../../admin/components/BookingActions";
import getBookingStatus from "../../hooks/getBookingStatus";
import Loading from "../Loading";
import { DatabaseContext } from "../Provider";
import { useTenantSchema } from "../SchemaProvider";
import BookMoreButton from "./BookMoreButton";
import BookingTableFilters from "./BookingTableFilters";
import EquipmentCheckoutToggle from "./EquipmentCheckoutToggle";
import MoreInfoModal from "./MoreInfoModal";
import StatusChip from "./StatusChip";
import { DateRangeFilter } from "./hooks/getDateFilter";
import useAllowedStatuses from "./hooks/useAllowedStatuses";
import { useBookingFilters } from "./hooks/useBookingFilters";

interface BookingsProps {
  pageContext: PageContextLevel;
  calendarEventId?: string;
}

export const Bookings: React.FC<BookingsProps> = ({
  pageContext,
  calendarEventId,
}) => {
  const { bookingsLoading, setLastItem, fetchAllBookings, allBookings } =
    useContext(DatabaseContext);
  const { resourceName } = useTenantSchema();
  const allowedStatuses = useAllowedStatuses(pageContext);

  const [modalData, setModalData] = useState<BookingRow>(null);
  const [statusFilters, setStatusFilters] = useState(() =>
    pageContext === PageContextLevel.LIAISON
      ? [BookingStatusLabel.REQUESTED]
      : []
  );
  const [selectedDateRange, setSelectedDateRange] =
    useState<DateRangeFilter>("All Future");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Add sort model state for DataGrid
  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: "startDate", sort: "asc" },
  ]);

  const isUserView = pageContext === PageContextLevel.USER;
  const isAdminOrAbove = pageContext >= PageContextLevel.ADMIN;

  useEffect(() => {
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

  // Reset sort to default when timeframe selection changes for admin users
  useEffect(() => {
    if (isAdminOrAbove) {
      setSortModel([{ field: "startDate", sort: "asc" }]);
    }
  }, [selectedDateRange, isAdminOrAbove]);

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

  const formatOrigin = (origin: string) => {
    const originMap = {
      user: "User",
      vip: "VIP",
      walkIn: "Walk-In",
      "walk-in": "Walk-In",
      pregame: "Pregame",
    };
    return originMap[origin] ?? origin;
  };

  const columns = useMemo(() => {
    const baseColumns = [
      {
        field: "origin",
        headerName: "#",
        minWidth: 60,
        flex: 1,
        renderHeader: () => <TableCell>Origin</TableCell>,
        renderCell: (params) => (
          <TableCell>{formatOrigin(params.row.origin ?? "User")}</TableCell>
        ),
      },
      {
        field: "requestNumber",
        headerName: "#",
        minWidth: 80,
        flex: 1,
        renderHeader: () => <TableCell>#</TableCell>,
        renderCell: (params) => (
          <TableCell>{params.row.requestNumber ?? "--"}</TableCell>
        ),
      },
      {
        field: "status",
        headerName: "Status",
        minWidth: 100,
        flex: 1,
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
        minWidth: 130,
        flex: 1,
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
        headerName: resourceName,
        minWidth: 100,
        flex: 1,
        renderHeader: () => <TableCell>{resourceName}</TableCell>,
        renderCell: (params) => (
          <TableCell sx={{ maxWidth: "150px" }}>{params.row.roomId}</TableCell>
        ),
      },
      ...(!isUserView
        ? [
            {
              field: "department",
              headerName: "Department / Role",
              minWidth: 150,
              flex: 1,
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
              minWidth: 100,
              flex: 1,
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
              minWidth: 180,
              flex: 1,
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
        minWidth: 200,
        flex: 2,
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
        minWidth: 80,
        flex: 1,
        renderHeader: () => <TableCell>Details</TableCell>,
        filterable: false,
        sortable: false,
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
              minWidth: 80,
              flex: 1,
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
        minWidth: 200,
        flex: 1,
        renderHeader: () => <TableCell>Action</TableCell>,
        filterable: false,
        sortable: false,
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
    ].filter(Boolean);

    return baseColumns;
  }, [isUserView, pageContext]);

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
        sortModel={sortModel}
        onSortModelChange={(newSortModel) => setSortModel(newSortModel)}
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
