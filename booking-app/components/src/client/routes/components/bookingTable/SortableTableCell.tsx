import { TableCell, TableSortLabel } from "@mui/material";

import { BookingRow } from "../../../../types";
import { ColumnSortOrder } from "./hooks/getColumnComparator";

interface Props<T extends BookingRow> {
  createSortHandler: any;
  property: keyof T;
  label: string;
  orderBy: keyof T;
  order: ColumnSortOrder;
}

export default function SortableTableCell<T extends BookingRow>(
  props: Props<T>
) {
  const { orderBy, order, property } = props;

  return (
    <TableCell
      key={property as string}
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
