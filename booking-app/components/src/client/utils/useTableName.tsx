import { TableNamesRaw, getTableName } from "../../policy";

import { useCallback } from "react";
import useTenant from "./useTenant";

export default function useTableName() {
  const tenant = useTenant();

  const tableName = useCallback(
    (table: TableNamesRaw) => {
      return getTableName(table, tenant);
    },
    [tenant]
  );

  return tableName;
}
