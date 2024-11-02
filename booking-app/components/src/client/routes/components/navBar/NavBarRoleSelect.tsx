import { MenuItem, Select } from "@mui/material";
import React, { useContext, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";

import { DatabaseContext } from "../Provider";
import { PagePermission } from "@/components/src/types";

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

  const { pagePermission } = useContext(DatabaseContext);

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

  const handleRoleChange = (e: any) => {
    switch (e.target.value as PagePermission) {
      case PagePermission.BOOKING:
        router.push("/media-commons");
        break;
      case PagePermission.PA:
        router.push("/media-commons/pa");
        break;
      case PagePermission.ADMIN:
        router.push("/media-commons/admin");
        break;
      case PagePermission.LIAISON:
        router.push("/media-commons/liaison");
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
