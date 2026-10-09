"use client";

import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from "@mui/material";
import { styled } from "@mui/system";
import React from "react";
import { formatOrigin } from "@/components/src/utils/formatters";
import { mergeRoomIdsWithAnnex } from "@/components/src/utils/resourceServicesUtils";
import {
  getBookingServicesByRoom,
  hasBookingServicesDisplay,
  type BookingServiceDisplayRow,
  type BookingServicesSource,
} from "@/components/src/utils/bookingServicesDisplay";
import { useTenantSchema } from "../SchemaProvider";
import { formatDateTable, formatTimeAmPm } from "../../../utils/date";
import StackedTableCell from "./StackedTableCell";

const SectionTitleBase = styled(Typography)({
  fontWeight: 700,
  margin: 0,
});

export function SectionTitle({
  variant = "subtitle1",
  ...props
}: React.ComponentProps<typeof SectionTitleBase>) {
  return <SectionTitleBase variant={variant} {...props} />;
}

/** Title + table with the same gap used under Services. */
export const Section = styled(Box)(({ theme }) => ({
  width: "100%",
  marginBottom: theme.spacing(3),
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1.5),
}));

export const LabelCell = styled(TableCell)(({ theme }) => ({
  borderRight: `1px solid ${theme.palette.custom.border}`,
  width: 175,
  verticalAlign: "top",
}));

const BLANK = "none";

type DateLike =
  | Date
  | string
  | number
  | { toDate: () => Date }
  | null
  | undefined;

/** Fields the booking details modal and the confirmation summary both render. */
export type BookingDetailsSummaryBooking = BookingServicesSource & {
  requestNumber?: number | null;
  status?: string | null;
  origin?: string | null;
  netId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  department?: string | null;
  otherDepartment?: string | null;
  role?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  secondaryFirstName?: string | null;
  secondaryLastName?: string | null;
  secondaryName?: string | null;
  secondaryEmail?: string | null;
  sponsorFirstName?: string | null;
  sponsorLastName?: string | null;
  sponsorEmail?: string | null;
  title?: string | null;
  description?: string | null;
  bookingType?: string | null;
  expectedAttendance?: string | null;
  attendeeAffiliation?: string | null;
  productionSchedule?: string | null;
  startDate?: DateLike;
  endDate?: DateLike;
};

function toDisplayDate(value: DateLike): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "object" && typeof value.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function ServiceDisplayRow({ row }: { row: BookingServiceDisplayRow }) {
  return (
    <TableRow>
      <LabelCell>{row.label}</LabelCell>
      {row.chartField ? (
        <StackedTableCell topText={row.value} bottomText={row.chartField} />
      ) : (
        <TableCell>{row.value}</TableCell>
      )}
    </TableRow>
  );
}

/**
 * Read-only Request, Requester, Details, and Services sections shared by the
 * booking details modal and the post-submit confirmation page.
 */
export default function BookingDetailsSummary({
  booking,
}: {
  booking: BookingDetailsSummaryBooking;
}) {
  const schema = useTenantSchema();
  const servicesDisplay = getBookingServicesByRoom(booking, schema.resources);
  const hasServices = hasBookingServicesDisplay(servicesDisplay);
  const start = toDisplayDate(booking.startDate);
  const end = toDisplayDate(booking.endDate);

  return (
    <Box sx={{ width: "100%" }}>
      <Section>
        <SectionTitle>Request</SectionTitle>
        <Table size="small">
          <TableBody>
            <TableRow>
              <LabelCell>Request #</LabelCell>
              <TableCell>{booking.requestNumber ?? BLANK}</TableCell>
            </TableRow>
            <TableRow>
              <LabelCell>Room(s)</LabelCell>
              <TableCell>
                {mergeRoomIdsWithAnnex(booking.roomId, booking.annexByRoom) ||
                  BLANK}
              </TableCell>
            </TableRow>
            <TableRow>
              <LabelCell>Date</LabelCell>
              <TableCell>{start ? formatDateTable(start) : BLANK}</TableCell>
            </TableRow>
            <TableRow>
              <LabelCell>Time</LabelCell>
              <TableCell>
                {start && end
                  ? `${formatTimeAmPm(start)} - ${formatTimeAmPm(end)} ET`
                  : BLANK}
              </TableCell>
            </TableRow>
            <TableRow>
              <LabelCell>Status</LabelCell>
              <TableCell>{booking.status ?? BLANK}</TableCell>
            </TableRow>
            {booking.origin && (
              <TableRow>
                <LabelCell>Origin</LabelCell>
                <TableCell>{formatOrigin(booking.origin)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Section>

      <Section>
        <SectionTitle>Requester</SectionTitle>
        <Table size="small">
          <TableBody>
            <TableRow>
              <LabelCell>NetID</LabelCell>
              <TableCell>{booking.netId ?? BLANK}</TableCell>
            </TableRow>
            <TableRow>
              <LabelCell>Name</LabelCell>
              <TableCell>
                {`${booking.firstName ?? ""} ${booking.lastName ?? ""}`.trim() ||
                  BLANK}
              </TableCell>
            </TableRow>
            <TableRow>
              <LabelCell>Department</LabelCell>
              <TableCell>
                {booking.department === "Other" && booking.otherDepartment
                  ? booking.otherDepartment
                  : (booking.department ?? BLANK)}
              </TableCell>
            </TableRow>
            <TableRow>
              <LabelCell>Role</LabelCell>
              <TableCell>{booking.role ?? BLANK}</TableCell>
            </TableRow>
            <TableRow>
              <LabelCell>Email</LabelCell>
              <TableCell>{booking.email ?? BLANK}</TableCell>
            </TableRow>
            <TableRow>
              <LabelCell>Phone</LabelCell>
              <TableCell>{booking.phoneNumber ?? BLANK}</TableCell>
            </TableRow>
            <TableRow>
              <LabelCell>Secondary Contact Name</LabelCell>
              <TableCell>
                {`${booking.secondaryFirstName ?? ""} ${booking.secondaryLastName ?? ""}`.trim() ||
                  booking.secondaryName ||
                  BLANK}
              </TableCell>
            </TableRow>
            <TableRow>
              <LabelCell>Secondary Contact Email</LabelCell>
              <TableCell>{booking.secondaryEmail || BLANK}</TableCell>
            </TableRow>
            {schema.form.showSponsor && (
              <TableRow>
                <LabelCell>Sponsor Name</LabelCell>
                <TableCell>
                  {`${booking.sponsorFirstName ?? ""} ${booking.sponsorLastName ?? ""}`.trim() ||
                    BLANK}
                </TableCell>
              </TableRow>
            )}
            {schema.form.showSponsor && (
              <TableRow>
                <LabelCell>Sponsor Email</LabelCell>
                <TableCell>{booking.sponsorEmail || BLANK}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Section>

      <Section>
        <SectionTitle>Details</SectionTitle>
        <Table size="small">
          <TableBody>
            <TableRow>
              <LabelCell>Title</LabelCell>
              <TableCell>{booking.title ?? BLANK}</TableCell>
            </TableRow>
            <TableRow>
              <LabelCell>Description</LabelCell>
              <TableCell>{booking.description ?? BLANK}</TableCell>
            </TableRow>
            {schema.form.showBookingType && (
              <TableRow>
                <LabelCell>Booking Type</LabelCell>
                <TableCell>{booking.bookingType ?? BLANK}</TableCell>
              </TableRow>
            )}
            <TableRow>
              <LabelCell>Expected Attendance</LabelCell>
              <TableCell>{booking.expectedAttendance ?? BLANK}</TableCell>
            </TableRow>
            <TableRow>
              <LabelCell>Attendee Affiliation</LabelCell>
              <TableCell>{booking.attendeeAffiliation ?? BLANK}</TableCell>
            </TableRow>
            {booking.productionSchedule?.trim() && (
              <TableRow>
                <LabelCell>
                  {schema.form.productionSchedule?.label ||
                    "Production Schedule"}
                </LabelCell>
                <TableCell>{booking.productionSchedule}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Section>

      {hasServices && (
        <Section>
          <SectionTitle>Services</SectionTitle>
          {servicesDisplay.bookingLevel.length > 0 && (
            <Table size="small">
              <TableBody>
                {servicesDisplay.bookingLevel.map((row) => (
                  <ServiceDisplayRow key={`booking-${row.key}`} row={row} />
                ))}
              </TableBody>
            </Table>
          )}
          {servicesDisplay.rooms.map((room) => (
            <Box
              key={room.roomId}
              sx={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                gap: 0.75,
              }}
            >
              <Typography
                variant="subtitle2"
                component="h3"
                sx={{ fontWeight: 600, m: 0 }}
              >
                {room.title}
              </Typography>
              <Table size="small">
                <TableBody>
                  {room.rows.map((row) => (
                    <ServiceDisplayRow
                      key={`${room.roomId}-${row.key}`}
                      row={row}
                    />
                  ))}
                </TableBody>
              </Table>
            </Box>
          ))}
        </Section>
      )}
    </Box>
  );
}
