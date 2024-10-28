import { TableCell, TableSortLabel } from "@mui/material";

import { BookingRow } from "../../../../types";
import { ColumnSortOrder } from "./hooks/getColumnComparator";
import React from "react";

interface Props {
  createSortHandler: any;
  property: keyof BookingRow;
  label: string;
  orderBy: keyof BookingRow;
  order: ColumnSortOrder;
}

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
