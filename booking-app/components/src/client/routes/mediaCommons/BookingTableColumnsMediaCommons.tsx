import {
  BookingMediaCommons,
  BookingRowMediaCommons,
} from "@/components/src/typesMediaCommons";
import React, { useMemo } from "react";

import { ColumnSortOrder } from "../components/bookingTable/hooks/getColumnComparator";
import { PageContextLevel } from "@/components/src/types";
import SortableTableCell from "../components/bookingTable/SortableTableCell";
import { TableCell } from "@mui/material";

interface Props {
  pageContext: PageContextLevel;
  createSortHandler: (
    property: keyof BookingMediaCommons
  ) => (_: React.MouseEvent<unknown>) => void;
  order: ColumnSortOrder;
  orderBy: keyof BookingRowMediaCommons;
}

export default function BookingTableColumnsMediaCommons({
  pageContext,
  createSortHandler,
  order,
  orderBy,
}: Props) {
  const isUserView = pageContext === PageContextLevel.USER;

  const columns = useMemo(
    () => [
      <SortableTableCell<BookingRowMediaCommons>
        label="#"
        property="requestNumber"
        key="requestNumber"
        {...{ createSortHandler, order, orderBy }}
      />,
      <SortableTableCell<BookingRowMediaCommons>
        key="status"
        label="Status"
        property="status"
        {...{ createSortHandler, order, orderBy }}
      />,
      <SortableTableCell<BookingRowMediaCommons>
        label="Date / Time"
        property="startDate"
        key="startDate"
        {...{ createSortHandler, order, orderBy }}
      />,
      <TableCell key="room">Room(s)</TableCell>,
      !isUserView && (
        <SortableTableCell<BookingRowMediaCommons>
          label="Department / Role"
          property="department"
          key="department"
          {...{ createSortHandler, order, orderBy }}
        />
      ),
      !isUserView && (
        <SortableTableCell<BookingRowMediaCommons>
          key="netId"
          label="Requestor"
          property="netId"
          {...{ createSortHandler, order, orderBy }}
        />
      ),
      !isUserView && <TableCell key="contacts">Contact Info</TableCell>,
      <TableCell key="title">Title</TableCell>,
      <TableCell key="other">Details</TableCell>,
      !isUserView && <TableCell key="equip">Equip.</TableCell>,
      <TableCell key="action">Action</TableCell>,
    ],
    [isUserView, order, orderBy]
  );

  return columns;
}
