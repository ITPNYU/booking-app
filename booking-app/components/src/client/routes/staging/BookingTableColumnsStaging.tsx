import {
  BookingRowStaging,
  BookingStaging,
} from "@/components/src/typesStaging";
import React, { useMemo } from "react";

import { ColumnSortOrder } from "../components/bookingTable/hooks/getColumnComparator";
import { PageContextLevel } from "@/components/src/types";
import SortableTableCell from "../components/bookingTable/SortableTableCell";
import { TableCell } from "@mui/material";

interface Props {
  pageContext: PageContextLevel;
  createSortHandler: (
    property: keyof BookingStaging
  ) => (_: React.MouseEvent<unknown>) => void;
  order: ColumnSortOrder;
  orderBy: keyof BookingRowStaging;
}

export default function BookingTableColumnsStaging({
  pageContext,
  createSortHandler,
  order,
  orderBy,
}: Props) {
  const isUserView = pageContext === PageContextLevel.USER;

  const columns = useMemo(
    () => [
      <SortableTableCell<BookingRowStaging>
        label="#"
        property="requestNumber"
        key="requestNumber"
        {...{ createSortHandler, order, orderBy }}
      />,
      <SortableTableCell<BookingRowStaging>
        key="status"
        label="Status"
        property="status"
        {...{ createSortHandler, order, orderBy }}
      />,
      <SortableTableCell<BookingRowStaging>
        label="Date / Time"
        property="startDate"
        key="startDate"
        {...{ createSortHandler, order, orderBy }}
      />,
      <TableCell key="room">Room(s)</TableCell>,
      !isUserView && (
        <SortableTableCell<BookingRowStaging>
          key="netId"
          label="Requestor"
          property="netId"
          {...{ createSortHandler, order, orderBy }}
        />
      ),
      <TableCell key="title">Title</TableCell>,
      <TableCell key="other">Details</TableCell>,
      <TableCell key="action">Action</TableCell>,
    ],
    [isUserView, order, orderBy]
  );

  return columns;
}
