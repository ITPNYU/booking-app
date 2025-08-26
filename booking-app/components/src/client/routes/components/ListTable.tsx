import { Box, TableCell, styled } from "@mui/material";
import React, { useMemo } from "react";

import ListTableRow from "./ListTableRow";
import Table from "./Table";
import { TableNames } from "../../../policy";
import { clientDeleteDataFromFirestore, clientDeleteUserRightsData } from "@/lib/firebase/firebase";

interface Props {
  columnFormatters?: {
    [key: string]: (value: string) => string | React.JSX.Element;
  };
  columnNameToRemoveBy: string;
  tableName: TableNames;
  rows: { [key: string]: string }[];
  rowsRefresh: () => Promise<void>;
  topRow: React.ReactNode;
  onRemoveRow?: (row: { [key: string]: string }) => Promise<void>;
}

const ListTableWrapper = styled(Table)`
  th {
    padding-right: 16px !important;
  }
`;

export default function ListTable(props: Props) {
  const refresh = props.rowsRefresh;
  const topRow = props.topRow;
  const columnFormatters = props.columnFormatters || {};

  const columnNames = useMemo<string[]>(() => {
    if (props.rows.length === 0) {
      return [];
    }
    return Object.keys(props.rows[0]).filter((x) => x !== "id") as string[];
  }, [props.rows]);

  const columns = useMemo(
    () => [
      ...columnNames?.map((columnName) => (
        <TableCell key={columnName}>{formatColumnName(columnName)}</TableCell>
      )),
      <TableCell align="right" key="action">
        Action
      </TableCell>,
    ],
    [columnNames]
  );

  return (
    <ListTableWrapper {...{ columns, topRow }}>
      {props?.rows.map((row, index: number) => (
        <ListTableRow
          key={index}
          removeRow={() =>
            props.onRemoveRow
              ? props.onRemoveRow(row)
              : (() => {
                  // Check if this is a user collection that should use the new logic
                  const userCollections = [TableNames.ADMINS, TableNames.PAS];
                  
                  if (userCollections.includes(props.tableName)) {
                    return clientDeleteUserRightsData(props.tableName, row.id);
                  } else {
                    return clientDeleteDataFromFirestore(props.tableName, row.id);
                  }
                })()
          }
          columnNames={columnNames}
          columnFormatters={columnFormatters}
          index={index}
          row={row}
          refresh={refresh}
        />
      ))}
    </ListTableWrapper>
  );
}

function formatColumnName(columnName: string): string {
  // Split the column name at capital letters or underscores
  const parts = columnName.split(/(?=[A-Z])|_/);

  // Capitalize the first letter of each word and join with spaces
  const formattedName = parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return formattedName;
}
