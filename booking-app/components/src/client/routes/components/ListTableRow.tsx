import { Button, IconButton, TableCell, TableRow } from "@mui/material";
import React, { useState } from "react";

import { Delete } from "@mui/icons-material";
import Loading from "./Loading";

interface Props {
  columnFormatters?: { [key: string]: (value: string) => string | React.JSX.Element};
  columnNames: string[];
  index: number;
  refresh: () => Promise<void>;
  removeRow: () => Promise<void>;
  row: { [key: string]: string };
}

export default function ListTableRow(props: Props) {
  const { columnFormatters, columnNames, index, refresh, removeRow, row } =
    props;
  const [uiLoading, setUiLoading] = useState(false);
  const [isRemoved, setIsRemoved] = useState(false);

  const onError = () => {
    alert("Failed to remove value");
  };

  /**
   * Google Sheets API writes are slow.
   * To avoid UI lag, assume write will succeed and optimistically remove UI element before response completes.
   * If write fails, alert the user and restore UI.
   * Only devs should see this error behavior unless something is very broken
   */
  const onRemove = async () => {
    setUiLoading(true);
    // setIsRemoved(true); // optimistically hide component
    try {
      removeRow()
        .catch(() => {
          onError();
          setIsRemoved(false);
        })
        .finally(refresh);
    } catch (ex) {
      console.error(ex);
      onError();
    } finally {
      setUiLoading(false);
    }
  };

  if (uiLoading) {
    return <Loading />;
  }

  if (isRemoved) {
    return null;
  }

  return (
    <TableRow key={index}>
      {columnNames.map((columnName, idx) => (
        <TableCell key={idx}>
          {columnFormatters[columnName]
            ? columnFormatters[columnName](row[columnName])
            : row[columnName]}
        </TableCell>
      ))}
      <TableCell align="right">
        <IconButton onClick={onRemove}>
          <Delete />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}
