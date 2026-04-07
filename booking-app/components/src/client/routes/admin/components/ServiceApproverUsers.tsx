import { AddCircleOutline } from "@mui/icons-material";
import { IconButton, TextField } from "@mui/material";
import Grid from "@mui/material/Unstable_Grid2/Grid2";
import { Timestamp, where } from "firebase/firestore";
import { useCallback, useContext, useEffect, useState } from "react";

import ListTable from "../../components/ListTable";
import { SchemaContext } from "../../components/SchemaProvider";
import { formatDate } from "../../../utils/date";
import { TableNames } from "../../../../policy";
import {
  UserRightFlagField,
  clientClearUserRightFlag,
  clientFetchAllDataFromCollection,
  clientUpsertUserRightFlag,
} from "@/lib/firebase/firebase";

type UserRightsRecord = {
  id: string;
  email: string;
  createdAt?: Timestamp;
};

interface ServiceApproverUsersProps {
  title: string;
  flagField: UserRightFlagField;
}

export const ServiceApproverUsers = ({
  title,
  flagField,
}: ServiceApproverUsersProps) => {
  const schemaContext = useContext(SchemaContext);
  const tenant = schemaContext?.tenant;

  const [loading, setLoading] = useState(false);
  const [valueToAdd, setValueToAdd] = useState("");
  const [serviceApprovers, setServiceApprovers] = useState<UserRightsRecord[]>([]);

  const loadServiceApprovers = useCallback(async () => {
    const fetchedData = await clientFetchAllDataFromCollection<any>(
      TableNames.USERS_RIGHTS,
      [where(flagField, "==", true)],
      tenant,
    );

    const filtered = fetchedData
      .map((item: any) => ({
        id: item.id,
        email: item.email,
        createdAt: item.createdAt,
      }))
      .sort((a: UserRightsRecord, b: UserRightsRecord) =>
        a.email.localeCompare(b.email),
      );

    setServiceApprovers(filtered);
  }, [flagField, tenant]);

  const addServiceApprover = useCallback(async () => {
    const trimmedEmail = valueToAdd.trim();
    if (!trimmedEmail) {
      return;
    }

    const duplicate = serviceApprovers.some(
      (record) => record.email.toLowerCase() === trimmedEmail.toLowerCase(),
    );
    if (duplicate) {
      alert("This user has already been added");
      return;
    }

    setLoading(true);
    try {
      await clientUpsertUserRightFlag(trimmedEmail, flagField, tenant);
      setValueToAdd("");
      await loadServiceApprovers();
    } catch (error) {
      console.error(error);
      alert("Failed to add user");
    } finally {
      setLoading(false);
    }
  }, [flagField, loadServiceApprovers, serviceApprovers, tenant, valueToAdd]);

  const removeServiceApprover = useCallback(
    async (row: { [key: string]: string }) => {
      await clientClearUserRightFlag(row.id, flagField, tenant);
    },
    [flagField, tenant],
  );

  useEffect(() => {
    loadServiceApprovers().catch((error) =>
      console.error("Error loading service approvers:", error),
    );
  }, [loadServiceApprovers]);

  const topRow = (
    <Grid
      container
      spacing={2}
      display="flex"
      justifyContent={"space-between"}
      alignItems={"center"}
    >
      <Grid sx={{ paddingLeft: "16px", color: "rgba(0,0,0,0.6)" }}>{title}</Grid>
      <Grid paddingLeft={0} paddingRight={4} display="flex" alignItems="center">
        <Grid container paddingRight={1}>
          <TextField
            id={`service-approver-${flagField}`}
            onChange={(e) => setValueToAdd(e.target.value)}
            value={valueToAdd}
            placeholder="Add email"
            size="small"
          />
        </Grid>
        <IconButton
          onClick={addServiceApprover}
          color="primary"
          sx={{ padding: 0 }}
          disabled={loading}
        >
          <AddCircleOutline />
        </IconButton>
      </Grid>
    </Grid>
  );

  return (
    <ListTable
      tableName={TableNames.USERS_RIGHTS}
      columnNameToRemoveBy="email"
      rows={serviceApprovers as unknown as { [key: string]: string }[]}
      rowsRefresh={loadServiceApprovers}
      topRow={topRow}
      onRemoveRow={removeServiceApprover}
      columnFormatters={{ createdAt: formatDate }}
    />
  );
};
