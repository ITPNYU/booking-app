import { Booking, BookingRow } from "../../../../types";
import { TableCell, TableSortLabel } from "@mui/material";

import React from "react";

interface Props {
  createSortHandler: any;
  property: keyof BookingRow;
  label: string;
  orderBy: keyof BookingRow;
  order: "asc" | "desc";
}

export const COMPARATORS: {
  [property: string]: (a: BookingRow, b: BookingRow) => number;
} = {
  startDate: (a, b) =>
    a.startDate.toDate().getTime() - b.startDate.toDate().getTime(),
  department: (a, b) => a.department.localeCompare(b.department),
  netId: (a, b) => a.netId.localeCompare(b.netId),
  status: (a, b) => a.status.localeCompare(b.status),
  requestNumber: (a, b) => (a.requestNumber ?? 0) - (b.requestNumber ?? 0),
};

export default function SortableTableCell(props: Props) {
  const { orderBy, order, property } = props;

  return (
    <TableCell
      key={property}
      sortDirection={orderBy === property ? order : false}
    >
      <TableSortLabel
        active={orderBy === property}
        direction={orderBy === property ? order : "asc"}
        onClick={props.createSortHandler(property)}
      >
        {props.label}
      </TableSortLabel>
    </TableCell>
  );
}
