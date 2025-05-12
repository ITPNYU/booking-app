import { Box, IconButton, TextField } from "@mui/material";
import React, { useMemo, useState } from "react";

import { AddCircleOutline } from "@mui/icons-material";
import Grid from "@mui/material/Unstable_Grid2/Grid2";
import Loading from "./Loading";
import { TableNames } from "../../../policy";
import { Timestamp } from "firebase/firestore";
import { clientSaveDataToFirestore } from "../../../../../lib/firebase/firebase";

interface Props {
  addDuplicateErrorMessage?: string;
  addFailedErrorMessage?: string;
  columnNameUniqueValue: string;
  valueToAdd: string;
  tableName: TableNames;
  rows: { [key: string]: string }[];
  rowsRefresh: () => Promise<void>;
  title: string;
  components?: React.ReactNode[];
  values?: { [key: string]: string };
}

export default function AddDepartmentRow(props: Props) {
  const { tableName, rows, rowsRefresh, title, components, values } = props;
  const [loading, setLoading] = useState(false);

  const uniqueValues = useMemo<string[]>(
    () => rows.map((row) => row[props.columnNameUniqueValue]),
    [rows]
  );

  const addValue = async () => {
    if (!props.valueToAdd || props.valueToAdd.length === 0) return;

    if (uniqueValues.includes(props.valueToAdd)) {
      alert(
        props.addDuplicateErrorMessage ?? "This value has already been added"
      );
      return;
    }

    setLoading(true);
    try {
      await clientSaveDataToFirestore(tableName, {
        [props.columnNameUniqueValue]: props.valueToAdd,
        ...(values ?? {}),
        createdAt: Timestamp.now(),
      });
      await rowsRefresh();
    } catch (ex) {
      console.error(ex);
      alert(props.addFailedErrorMessage ?? "Failed to add value");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Grid
      container
      spacing={2}
      display="flex"
      justifyContent={"space-between"}
      alignItems={"center"}
    >
      <Grid sx={{ paddingLeft: "16px", color: "rgba(0,0,0,0.6)" }}>
        {title}
      </Grid>
      <Grid paddingLeft={0} paddingRight={4} display="flex" alignItems="center">
        <Grid container paddingRight={1}>
          {...components ?? []}
        </Grid>
        {loading ? (
          <Loading style={{ height: "25px", width: "25px" }} />
        ) : (
          <IconButton onClick={addValue} color="primary" sx={{ padding: 0 }}>
            <AddCircleOutline />
          </IconButton>
        )}
      </Grid>
    </Grid>
  );
}
