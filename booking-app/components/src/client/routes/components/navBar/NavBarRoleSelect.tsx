import { MenuItem, Select } from "@mui/material";
import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";

import { PagePermission } from "@/components/src/types";
import { Tenants } from "@/components/src/policy";
import { useSharedDatabase } from "../../../providers/SharedDatabaseProvider";
import useTenant from "../../../utils/useTenant";

interface Props {
  selectedView: PagePermission;
  setSelectedView: (x: PagePermission) => void;
}

export default function NavBarRoleSelect({
  selectedView,
  setSelectedView,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const tenant = useTenant();

  const { pagePermission } = useSharedDatabase();

  useEffect(() => {
    if (pathname === "/") {
      setSelectedView(PagePermission.BOOKING);
    } else if (pathname.includes("/pa")) {
      setSelectedView(PagePermission.PA);
    } else if (pathname.includes("/admin")) {
      setSelectedView(PagePermission.ADMIN);
    } else if (pathname.includes("/liaison")) {
      setSelectedView(PagePermission.LIAISON);
    }
  }, [pathname]);

  const tenantToPathPrefix = () => {
    switch (tenant) {
      case Tenants.MEDIA_COMMONS:
        return "/media-commons";
      case Tenants.STAGING:
        return "/staging";
    }
  };

  const handleRoleChange = (e: any) => {
    const tenantPrefix = tenantToPathPrefix();
    switch (e.target.value as PagePermission) {
      case PagePermission.BOOKING:
        router.push(tenantPrefix);
        break;
      case PagePermission.PA:
        router.push(`${tenantPrefix}/pa`);
        break;
      case PagePermission.ADMIN:
        router.push(`${tenantPrefix}/admin`);
        break;
      case PagePermission.LIAISON:
        router.push(`${tenantPrefix}liaison`);
        break;
    }
  };

  const dropdown = useMemo(() => {
    if (
      pagePermission !== PagePermission.ADMIN &&
      pagePermission !== PagePermission.PA &&
      pagePermission !== PagePermission.LIAISON
    ) {
      return null;
    }

    const showPA =
      pagePermission === PagePermission.PA ||
      pagePermission === PagePermission.ADMIN;
    const showLiaison =
      pagePermission === PagePermission.LIAISON ||
      pagePermission === PagePermission.ADMIN;
    const showAdmin = pagePermission === PagePermission.ADMIN;

    return (
      <Select size="small" value={selectedView} onChange={handleRoleChange}>
        <MenuItem value={PagePermission.BOOKING}>User</MenuItem>
        {showPA && <MenuItem value={PagePermission.PA}>PA</MenuItem>}
        {showLiaison && (
          <MenuItem value={PagePermission.LIAISON}>Liaison</MenuItem>
        )}
        {showAdmin && <MenuItem value={PagePermission.ADMIN}>Admin</MenuItem>}
      </Select>
    );
  }, [pagePermission, selectedView]);

  return dropdown;
}
