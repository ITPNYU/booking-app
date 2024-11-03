import { TableNamesRaw, Tenants, getTableName } from "../../policy";

import { useCallback } from "react";
import { usePathname } from "next/navigation";

export default function useTableName() {
  const pathname = usePathname();

  const tableName = useCallback(
    (table: TableNamesRaw) => {
      let tenant = Tenants.MEDIA_COMMONS;
      if (pathname.includes("/staging")) {
        tenant = Tenants.STAGING;
      }
      return getTableName(table, tenant);
    },
    [pathname]
  );

  return tableName;
}
