import { IconButton, TextField } from "@mui/material";
import React, { useMemo, useState } from "react";

import { Timestamp } from "firebase/firestore";
import { AddCircleOutline } from "@mui/icons-material";
import Grid from "@mui/material/Unstable_Grid2/Grid2";
import { clientSaveDataToFirestore, clientSaveUserRightsData } from "../../../../../lib/firebase/firebase";
import { TableNames } from "../../../policy";
import Loading from "./Loading";

interface Props {
  addDuplicateErrorMessage?: string;
  addFailedErrorMessage?: string;
  columnNameUniqueValue: string;
  inputPlaceholder?: string;
  tableName: TableNames;
  rows: { [key: string]: string }[];
  rowsRefresh: () => Promise<void>;
  title: string;
  extra?: {
    components?: React.ReactNode[];
    values: { [key: string]: any };
    updates?: ((x: string) => void)[];
  };
}

export default function AddRow(props: Props) {
  const { tableName, rows, rowsRefresh, title, extra } = props;
  const [valueToAdd, setValueToAdd] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const uniqueValues = useMemo<string[]>(
    () => rows.map((row) => row[props.columnNameUniqueValue]),
    [rows]
  );

  const addValue = async () => {
    if (!valueToAdd || valueToAdd.length === 0) return;

    if (uniqueValues.includes(valueToAdd)) {
      alert(
        props.addDuplicateErrorMessage ?? "This value has already been added"
      );
      return;
    }

    setLoading(true);
    try {
      // Check if this is a user collection that should use the new logic
      const userCollections = [TableNames.ADMINS, TableNames.PAS, TableNames.SUPER_ADMINS];
      
      if (userCollections.includes(tableName)) {
        await clientSaveUserRightsData(tableName, {
          [props.columnNameUniqueValue]: valueToAdd.trim(),
          ...(extra?.values ?? {}),
          createdAt: Timestamp.now(),
        });
      } else {
        await clientSaveDataToFirestore(tableName, {
          [props.columnNameUniqueValue]: valueToAdd.trim(),
          ...(extra?.values ?? {}),
          createdAt: Timestamp.now(),
        });
      }
      await rowsRefresh();
    } catch (ex) {
      console.error(ex);
      alert(props.addFailedErrorMessage ?? "Failed to add value");
    } finally {
      setLoading(false);
      setValueToAdd("");
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
          <TextField
            id="valueToAdd"
            onChange={(e) => {
              setValueToAdd(e.target.value);
            }}
            value={valueToAdd}
            placeholder={props.inputPlaceholder ?? ""}
            size="small"
          />
          {...extra?.components ?? []}
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
