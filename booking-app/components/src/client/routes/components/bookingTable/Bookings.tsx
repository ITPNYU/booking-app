import {
  MoreHoriz,
  TableBar,
  Headset,
  PeopleAlt,
  LocalDining,
  CleaningServices,
  LocalPolice,
  Check,
  Close,
  Replay,
} from "@mui/icons-material";
import {
  Box,
  IconButton,
  TableCell,
  Tooltip,
  tooltipClasses,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { DataGrid, GridSortModel } from "@mui/x-data-grid";
import React, { useContext, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  BookingOrigin,
  BookingRow,
  BookingStatusLabel,
  PageContextLevel,
} from "../../../../types";
import { TableEmpty } from "../Table";
import StackedTableCell from "./StackedTableCell";

import { formatOrigin } from "../../../../utils/formatters";
import { formatDateTable, formatTimeAmPm } from "../../../utils/date";
import BookingActions from "../../admin/components/BookingActions";
import getBookingStatus from "../../hooks/getBookingStatus";
import Loading from "../Loading";
import { DatabaseContext } from "../Provider";
import { useTenantSchema } from "../SchemaProvider";
import BookMoreButton from "./BookMoreButton";
import BookingTableFilters from "./BookingTableFilters";
import EquipmentCartDisplay from "./EquipmentCartDisplay";
import MoreInfoModal from "./MoreInfoModal";
import StatusChip from "./StatusChip";
import { DateRangeFilter } from "./hooks/getDateFilter";
import useAllowedStatuses from "./hooks/useAllowedStatuses";
import {
  formatBookingInterimHours,
  getBookingInterimHours,
  isAwaitingApprovalStatus,
} from "../../../../utils/bookingInterimHours";
import { useBookingFilters } from "./hooks/useBookingFilters";

type LatestBookingStatusLog = {
  status: BookingStatusLabel;
  changedAt: number;
};

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
  const {
    resourceName,
    showSetup,
    showEquipment,
    showStaffing,
    showCatering,
    showHireSecurity,
    interimHighlightThresholdHours = 18,
  } = useTenantSchema();
  const hasServices =
    showSetup ||
    showEquipment ||
    showStaffing ||
    showCatering ||
    showHireSecurity;
  const theme = useTheme();
  const params = useParams();
  const tenant = params?.tenant as string;
  const excludedStatuses = [
    BookingStatusLabel.CANCELED,
    BookingStatusLabel.EQUIPMENT,
    BookingStatusLabel.NO_SHOW,
    BookingStatusLabel.PENDING,
    BookingStatusLabel.MODIFIED,
  ];
  const allowedStatuses = useAllowedStatuses(pageContext).filter(
    (status) => !excludedStatuses.includes(status),
  );

  const [modalData, setModalData] = useState<BookingRow>(null);
  const [statusFilters, setStatusFilters] = useState(() =>
    pageContext === PageContextLevel.LIAISON
      ? [BookingStatusLabel.REQUESTED]
      : [],
  );
  const [selectedDateRange, setSelectedDateRange] =
    useState<DateRangeFilter>(() =>
      pageContext === PageContextLevel.PA ? "Today" : "All Future"
    );

  // Added filters for origin, rooms, and services
  const [selectedOrigins, setSelectedOrigins] = useState<string[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Add sort model state for DataGrid
  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: "startDate", sort: "asc" },
  ]);
  const [latestStatusLogsByBookingId, setLatestStatusLogsByBookingId] =
    useState<Record<string, LatestBookingStatusLog>>({});

  const isUserView = pageContext === PageContextLevel.USER;
  const isAdminOrAbove = pageContext >= PageContextLevel.ADMIN;

  useEffect(
    () => () => {
      setLastItem(null);
    },
    [],
  );

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
      }
      setIsSearching(false);
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
    selectedOrigins,
    selectedRooms,
    selectedServices,
  });

  const latestStatusLogRequests = useMemo(() => {
    if (isUserView) return [];

    const requestsByCalendarEventId = new Map<
      string,
      { calendarEventId: string; status: BookingStatusLabel }
    >();
    filteredRows.forEach((row) => {
      const status = getBookingStatus(row, tenant);
      if (!isAwaitingApprovalStatus(status) || !row.calendarEventId) return;
      requestsByCalendarEventId.set(row.calendarEventId, {
        calendarEventId: row.calendarEventId,
        status,
      });
    });

    return [...requestsByCalendarEventId.values()];
  }, [filteredRows, isUserView, tenant]);

  useEffect(() => {
    if (latestStatusLogRequests.length === 0) {
      setLatestStatusLogsByBookingId({});
      return;
    }

    const controller = new AbortController();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (tenant) {
      headers["x-tenant"] = tenant;
    }

    fetch("/api/booking-logs/latest", {
      method: "POST",
      headers,
      body: JSON.stringify({ bookings: latestStatusLogRequests }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to fetch latest booking logs: ${response.status}`,
          );
        }
        return response.json();
      })
      .then((latestLogs: Record<string, LatestBookingStatusLog>) => {
        setLatestStatusLogsByBookingId(latestLogs);
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        console.error("Error fetching latest booking logs:", error);
        setLatestStatusLogsByBookingId({});
      });

    return () => controller.abort();
  }, [latestStatusLogRequests, tenant]);

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
        selectedOrigins={selectedOrigins}
        setSelectedOrigins={setSelectedOrigins}
        selectedRooms={selectedRooms}
        setSelectedRooms={setSelectedRooms}
        selectedServices={selectedServices}
        setSelectedServices={setSelectedServices}
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
    selectedOrigins,
    selectedRooms,
    selectedServices,
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

  const columns = useMemo(() => {
    const baseColumns = [
      {
        field: "origin",
        headerName: "#",
        minWidth: 60,
        flex: 1,
        renderHeader: () => <TableCell component={"div" as any}>Origin</TableCell>,
        renderCell: (params) => (
          <TableCell component={"div" as any}>
            {formatOrigin(params.row.origin ?? BookingOrigin.USER)}
          </TableCell>
        ),
      },
      {
        field: "requestNumber",
        headerName: "#",
        minWidth: 80,
        flex: 1,
        renderHeader: () => <TableCell component={"div" as any}>#</TableCell>,
        renderCell: (params) => (
          <TableCell component={"div" as any}>{params.row.requestNumber ?? "--"}</TableCell>
        ),
      },
      {
        field: "status",
        headerName: "Status",
        minWidth: 100,
        flex: 1,
        renderHeader: () => <TableCell component={"div" as any}>Status</TableCell>,
        renderCell: (params) => (
          <TableCell component={"div" as any}>
            <StatusChip
              status={getBookingStatus(params.row)}
              allowTooltip={true}
            />
          </TableCell>
        ),
      },
      ...(!isUserView
        ? [
            {
              field: "interim",
              type: "number" as const,
              headerName: "Interim",
              minWidth: 88,
              flex: 0.75,
              valueGetter: (_value: unknown, row: BookingRow) => {
                const status = getBookingStatus(row, tenant);
                const latestLog =
                  latestStatusLogsByBookingId[row.calendarEventId];
                const latestStatusChangedAt =
                  latestLog?.status === status ? latestLog.changedAt : undefined;

                return getBookingInterimHours(
                  row,
                  tenant,
                  latestStatusChangedAt,
                );
              },
              renderHeader: () => (
                <TableCell component={"div" as any}>
                  <Tooltip title="Hours in current approval stage. REQUESTED: since submitted. PRE-APPROVED: since first approval. Shows 0 once fully approved.">
                    <span>Interim (h)</span>
                  </Tooltip>
                </TableCell>
              ),
              renderCell: (params: { value?: number | null }) => (
                <TableCell component={"div" as any}>
                  {formatBookingInterimHours(params.value ?? null)}
                </TableCell>
              ),
              sortComparator: (v1, v2) => {
                const a = v1 as number | null;
                const b = v2 as number | null;
                if (a == null && b == null) return 0;
                if (a == null) return 1;
                if (b == null) return -1;
                return a - b;
              },
            },
          ]
        : []),
      {
        field: "startDate",
        headerName: "Date / Time",
        minWidth: 130,
        flex: 1,
        renderHeader: () => <TableCell component={"div" as any}>Date / Time (ET)</TableCell>,
        renderCell: (params) => (
          <StackedTableCell
            topText={formatDateTable(params.row.startDate.toDate())}
            bottomText={`${formatTimeAmPm(params.row.startDate.toDate())} - ${formatTimeAmPm(
              params.row.endDate.toDate(),
            )} ET`}
          />
        ),
      },
      {
        field: "room",
        headerName: resourceName,
        minWidth: 100,
        flex: 1,
        renderHeader: () => <TableCell component={"div" as any}>{resourceName}</TableCell>,
        renderCell: (params) => (
          <TableCell component={"div" as any} sx={{ maxWidth: "150px" }}>{params.row.roomId}</TableCell>
        ),
      },
      ...(!isUserView
        ? [
            {
              field: "department",
              headerName: "Department / Role",
              minWidth: 150,
              flex: 1,
              renderHeader: () => <TableCell component={"div" as any}>Department / Role</TableCell>,
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
              renderHeader: () => <TableCell component={"div" as any}>Requestor</TableCell>,
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
              renderHeader: () => <TableCell component={"div" as any}>Contact Info</TableCell>,
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
        renderHeader: () => <TableCell component={"div" as any}>Title</TableCell>,
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
              component={"div" as any}
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
        filterable: false,
        sortable: false,
        renderHeader: () => <TableCell component={"div" as any}>Details</TableCell>,
        renderCell: (params) => (
          <TableCell component={"div" as any}>
            <IconButton onClick={() => setModalData(params.row)}>
              <MoreHoriz />
            </IconButton>
          </TableCell>
        ),
      },
      ...(!isUserView && hasServices
        ? [
            {
              field: "services",
              headerName: "Services",
              minWidth: 240,
              flex: 1,
              filterable: false,
              renderHeader: () => <TableCell component={"div" as any}>Services</TableCell>,
              renderCell: (params) => {
                const bookingRow = params.row as BookingRow;

                const colorFor = (requested: boolean) =>
                  requested ? "rgba(0, 0, 0, 0.8)" : "rgba(0, 0, 0, 0.08)";

                const servicesRequested =
                  bookingRow.xstateData?.snapshot?.context?.servicesRequested ||
                  {};
                const servicesApproved =
                  bookingRow.xstateData?.snapshot?.context?.servicesApproved ||
                  {};

                const rawXStateValue = bookingRow.xstateData?.snapshot?.value;
                const isBookingClosed =
                  typeof rawXStateValue === "string" &&
                  rawXStateValue === "Closed";
                const servicesClosedout =
                  typeof rawXStateValue === "object"
                    ? rawXStateValue["Service Closeout"]
                    : null;

                const isServiceClosedOut = (
                  closeoutKey: string,
                  closedLabel: string,
                ) => {
                  if (isBookingClosed) return true;

                  // If no services closeout data exists, return false
                  if (
                    !servicesClosedout ||
                    typeof servicesClosedout !== "object"
                  )
                    return false;

                  const val = servicesClosedout[closeoutKey];
                  return val === closedLabel;
                };

                const items: {
                  label: string;
                  Icon: any;
                  requested: boolean;
                  serviceKey: string;
                  closeoutKey: string;
                  closedout: boolean;
                }[] = [
                  {
                    label: "Setup",
                    Icon: TableBar,
                    requested: servicesRequested.setup || false,
                    serviceKey: "setup",
                    closeoutKey: "Setup Closeout",
                    closedout: isServiceClosedOut(
                      "Setup Closeout",
                      "Setup Closedout",
                    ),
                  },
                  {
                    label: "Equipment",
                    Icon: Headset,
                    requested: servicesRequested.equipment || false,
                    serviceKey: "equipment",
                    closeoutKey: "Equipment Closeout",
                    closedout: isServiceClosedOut(
                      "Equipment Closeout",
                      "Equipment Closedout",
                    ),
                  },
                  {
                    label: "Staffing",
                    Icon: PeopleAlt,
                    requested: servicesRequested.staff || false,
                    serviceKey: "staff",
                    closeoutKey: "Staff Closeout",
                    closedout: isServiceClosedOut(
                      "Staff Closeout",
                      "Staff Closedout",
                    ),
                  },
                  {
                    label: "Catering",
                    Icon: LocalDining,
                    requested: servicesRequested.catering || false,
                    serviceKey: "catering",
                    closeoutKey: "Catering Closeout",
                    closedout: isServiceClosedOut(
                      "Catering Closeout",
                      "Catering Closedout",
                    ),
                  },
                  {
                    label: "Cleaning",
                    Icon: CleaningServices,
                    requested: servicesRequested.cleaning || false,
                    serviceKey: "cleaning",
                    closeoutKey: "Cleaning Closeout",
                    closedout: isServiceClosedOut(
                      "Cleaning Closeout",
                      "Cleaning Closedout",
                    ),
                  },
                  {
                    label: "Security",
                    Icon: LocalPolice,
                    requested: servicesRequested.security || false,
                    serviceKey: "security",
                    closeoutKey: "Security Closeout",
                    closedout: isServiceClosedOut(
                      "Security Closeout",
                      "Security Closedout",
                    ),
                  },
                ];

                return (
                  <TableCell
                    component={"div" as any}
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      gap: "6px",
                    }}
                  >
                    {items.map(
                      ({ label, Icon, requested, serviceKey, closedout }) => {
                        const approved = servicesApproved[serviceKey];
                        const showApprovalBadge =
                          requested &&
                          (approved === true || approved === false);
                        const showCloseoutBadge =
                          requested && approved === true && closedout;

                        return (
                          <Tooltip key={label} title={label} placement="top">
                            <span
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: "2px",
                                padding: "4px 6px",
                                borderRadius: "6px",
                              }}
                            >
                              <Icon
                                style={{
                                  fontSize: "18px",
                                  color: colorFor(requested),
                                }}
                              />
                              {showApprovalBadge && !showCloseoutBadge && (
                                <>
                                  {approved === true ? (
                                    <Check
                                      sx={{
                                        fontSize: "10px",
                                        bottom: "-6px",
                                        right: "-6px",
                                        borderRadius: "50%",
                                        strokeWidth: 1.4,
                                        stroke: "rgba(72, 196, 77, 1)",
                                        color: "rgba(72, 196, 77, 1)",
                                      }}
                                    />
                                  ) : (
                                    <Close
                                      sx={{
                                        fontSize: "10px",
                                        bottom: "-6px",
                                        right: "-6px",
                                        borderRadius: "50%",
                                        strokeWidth: 1.4,
                                        stroke: "rgba(255, 26, 26, 1)",
                                        color: "rgba(255, 26, 26, 1)",
                                      }}
                                    />
                                  )}
                                </>
                              )}
                              {showCloseoutBadge && (
                                <Replay
                                  sx={{
                                    fontSize: "10px",
                                    bottom: "-6px",
                                    right: "-6px",
                                    borderRadius: "50%",
                                    strokeWidth: 1.0,
                                    stroke: "#333333",
                                    color: "#333333",
                                  }}
                                />
                              )}
                            </span>
                          </Tooltip>
                        );
                      },
                    )}
                  </TableCell>
                );
              },
            },
            {
              field: "equip",
              headerName: "Equip.",
              minWidth: 80,
              flex: 1,
              filterable: false,
              renderHeader: () => <TableCell component={"div" as any}>Equip.</TableCell>,
              renderCell: (params) => (
                <TableCell component={"div" as any}>
                  <EquipmentCartDisplay
                    booking={params.row}
                    onCartClick={() => setModalData(params.row)}
                    pageContext={pageContext}
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
        filterable: false,
        sortable: false,
        renderHeader: () => <TableCell component={"div" as any}>Action</TableCell>,
        renderCell: (params) => (
          <TableCell component={"div" as any} width={200}>
            <BookingActions
              status={getBookingStatus(params.row, tenant)}
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
  }, [
    isUserView,
    pageContext,
    tenant,
    resourceName,
    hasServices,
    latestStatusLogsByBookingId,
  ]);

  // Function to update a booking in the local state
  const updateBookingInState = (updatedBooking: BookingRow) => {
    // This is a simple implementation - in a real app you might want to
    // update the booking in your state management system
    setModalData(updatedBooking);
    // You could also trigger a refetch of bookings here if needed
  };

  const pageSize = 100;
  const showFooter = useMemo(
    () => filteredRows.length > pageSize,
    [filteredRows.length, pageSize],
  );

  return (
    <Box sx={{ marginTop: 4 }}>
      <div
        style={{
          padding: "12px 0",
          border: "1px solid rgba(224, 224, 224, 1)",
          borderBottom: "none",
          borderRadius: "4px 4px 0px 0px",
        }}
      >
        {topRow}
      </div>
      <DataGrid
        rows={filteredRows}
        columns={columns}
        getRowId={(row) => row.calendarEventId}
        getCellClassName={(params) =>
          !isUserView &&
          params.field === "interim" &&
          typeof params.value === "number" &&
          params.value >= interimHighlightThresholdHours
            ? "booking-cell-interim-over-threshold"
            : ""
        }
        hideFooter={!showFooter}
        initialState={{
          pagination: {
            paginationModel: {
              pageSize,
            },
          },
        }}
        pageSizeOptions={[pageSize]}
        checkboxSelection={false}
        disableRowSelectionOnClick
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
          "& .MuiDataGrid-cell.booking-cell-interim-over-threshold": {
            fontWeight: 600,
            color: theme.palette.primary.main,
          },
          "& .MuiDataGrid-cell.booking-cell-interim-over-threshold .MuiTableCell-root":
            {
              fontWeight: 600,
              color: theme.palette.primary.main,
            },
          borderRadius: "0px 0px 4px 4px",
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
          updateBooking={updateBookingInState}
          pageContext={pageContext}
        />
      )}
    </Box>
  );
};
