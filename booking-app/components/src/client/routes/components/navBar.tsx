"use client";

import {
  Box,
  Button,
  MenuItem,
  Select,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useContext, useEffect, useMemo, useState } from "react";

import { auth } from "@/lib/firebase/firebaseClient";
import { styled } from "@mui/system";
import { signOut } from "firebase/auth";
import { PagePermission } from "../../../types";
import useHandleStartBooking from "../booking/hooks/useHandleStartBooking";
import ConfirmDialog from "./ConfirmDialog";
import { DatabaseContext } from "./Provider";
import { SchemaContext } from "./SchemaProvider";

const LogoBox = styled(Box)`
  cursor: pointer;
  display: flex;
  align-items: flex-end;

  img {
    margin-right: 8px;
  }
`;

const Title = styled(Typography)`
  width: fit-content;
  font-size: 20px;
  font-weight: 500;
`;

const Nav = styled(Toolbar)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.custom.border}`,
  justifyContent: "space-between",
}));

const Divider = styled(Box)(({ theme }) => ({
  width: "2px",
  height: "32px",
  background: theme.palette.custom.gray,
  margin: "0px 20px",
}));

// Helper function to convert PagePermission to path segment
const getPathFromPermission = (permission: PagePermission): string => {
  switch (permission) {
    case PagePermission.PA:
      return "pa";
    case PagePermission.ADMIN:
      return "admin";
    case PagePermission.LIAISON:
      return "liaison";
    case PagePermission.SERVICES:
      return "services";
    case PagePermission.SUPER_ADMIN:
      return "super";
    case PagePermission.BOOKING:
    default:
      return "";
  }
};

export default function NavBar() {
  const router = useRouter();
  const { tenant } = useParams();
  const { pagePermission, netId, setUserEmail } = useContext(DatabaseContext);
  const handleStartBooking = useHandleStartBooking();
  const [selectedView, setSelectedView] = useState<PagePermission>(
    PagePermission.BOOKING
  );
  const pathname = usePathname();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const tenantSchema = useContext(SchemaContext);
  const {
    name = "",
    logo = "/mediaCommonsLogo.svg",
    supportVIP = false,
    supportWalkIn = false,
  } = tenantSchema || {};

  const isRoot = pathname === "/" || (tenant && pathname === `/${tenant}`);

  const handleRoleChange = (e: any) => {
    const pathSegment = getPathFromPermission(e.target.value as PagePermission);
    const fullPath = tenant ? `/${tenant}/${pathSegment}` : `/${pathSegment}`;
    router.push(fullPath);
  };

  const handleClickHome = () => {
    setSelectedView(PagePermission.BOOKING);
    router.push(`/${tenant || ""}`);
  };

  const handleClickRoot = () => {
    setSelectedView(PagePermission.BOOKING);
    router.push("/");
  };

  const envTitle = (() => {
    const branch = process.env.NEXT_PUBLIC_BRANCH_NAME;
    if (branch.toLowerCase() === "production") {
      return "";
    }
    const branchTitle = branch.charAt(0).toUpperCase() + branch.slice(1);
    return `[${branchTitle}]`;
  })();

  useEffect(() => {
    const isTenantRoot = /^\/[^/]+$/.test(pathname);

    if (pathname === "/" || isTenantRoot) {
      setSelectedView(PagePermission.BOOKING);
    } else if (pathname.includes("/pa")) {
      setSelectedView(PagePermission.PA);
    } else if (pathname.includes("/admin")) {
      setSelectedView(PagePermission.ADMIN);
    } else if (pathname.includes("/liaison")) {
      setSelectedView(PagePermission.LIAISON);
    } else if (pathname.includes("/services")) {
      setSelectedView(PagePermission.SERVICES);
    } else if (pathname.includes("/super")) {
      setSelectedView(PagePermission.SUPER_ADMIN);
    }
  }, [pathname]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      sessionStorage.removeItem("hasRedirectedToDefaultContext");
      console.log("Sign-out successful");
      router.push("/signin");
      setUserEmail(null);
    } catch (error) {
      console.error("Sign-out error", error);
    }
  };

  useEffect(() => {
    if (!isRoot) return;

    const hasRedirected = sessionStorage.getItem(
      "hasRedirectedToDefaultContext"
    );
    if (hasRedirected) return;

    if (pagePermission !== PagePermission.BOOKING) {
      const targetPath = getPathFromPermission(pagePermission);

      if (targetPath) {
        const fullPath = tenant ? `/${tenant}/${targetPath}` : `/${targetPath}`;
        router.push(fullPath);
        sessionStorage.setItem("hasRedirectedToDefaultContext", "true");
      }
    }
  }, [pagePermission, pathname, tenant, router, isRoot]);

  const hasUserPermission = (roles: PagePermission[]) => {
    return roles.includes(pagePermission);
  };

  const dropdown = useMemo(() => {
    // First check if user has any admin privileges
    if (
      !hasUserPermission([
        PagePermission.ADMIN,
        PagePermission.PA,
        PagePermission.LIAISON,
        PagePermission.SUPER_ADMIN,
      ])
    ) {
      return null;
    }

    const showPA = hasUserPermission([
      PagePermission.PA,
      PagePermission.ADMIN,
      PagePermission.SUPER_ADMIN,
    ]);

    const showLiaison = hasUserPermission([
      PagePermission.LIAISON,
      PagePermission.ADMIN,
      PagePermission.SUPER_ADMIN,
    ]);

    const showAdmin = hasUserPermission([
      PagePermission.ADMIN,
      PagePermission.SUPER_ADMIN,
    ]);

    const showServices = hasUserPermission([
      PagePermission.SERVICES,
      PagePermission.ADMIN,
      PagePermission.SUPER_ADMIN,
    ]);

    const showSuperAdmin = hasUserPermission([PagePermission.SUPER_ADMIN]);

    return (
      <Select size="small" value={selectedView} onChange={handleRoleChange}>
        <MenuItem value={PagePermission.BOOKING}>User</MenuItem>
        {showPA && <MenuItem value={PagePermission.PA}>PA</MenuItem>}
        {showLiaison && (
          <MenuItem value={PagePermission.LIAISON}>Liaison</MenuItem>
        )}
        {showServices && (
          <MenuItem value={PagePermission.SERVICES}>Services</MenuItem>
        )}
        {showAdmin && <MenuItem value={PagePermission.ADMIN}>Admin</MenuItem>}
        {showSuperAdmin && (
          <MenuItem value={PagePermission.SUPER_ADMIN}>Super</MenuItem>
        )}
      </Select>
    );
  }, [pagePermission, selectedView]);

  const button = useMemo(() => {
    // Do not show the button for super admin or liaison page.
    if (
      selectedView === PagePermission.SUPER_ADMIN ||
      selectedView === PagePermission.LIAISON
    ) {
      return null;
    }

    if (selectedView === PagePermission.BOOKING) {
      return (
        <Button
          onClick={() => {
            handleStartBooking();
            router.push(`/${tenant}/book`);
          }}
          variant="outlined"
          sx={{ height: "40px", marginRight: 2 }}
        >
          Book
        </Button>
      );
    }

    if (supportVIP && selectedView === PagePermission.ADMIN) {
      return (
        <Button
          onClick={() => {
            handleStartBooking();
            router.push("/vip");
          }}
          variant="outlined"
          sx={{ height: "40px", marginRight: 2 }}
        >
          VIP
        </Button>
      );
    }

    if (
      supportWalkIn &&
      pagePermission !== PagePermission.BOOKING &&
      selectedView !== PagePermission.SERVICES
    ) {
      return (
        <Button
          onClick={() => {
            handleStartBooking();
            router.push(`/${tenant}/walk-in`);
          }}
          variant="outlined"
          sx={{ height: "40px", marginRight: 2 }}
        >
          Walk In
        </Button>
      );
    }
  }, [pagePermission, selectedView, tenant]);

  return (
    <Nav>
      <div style={{ display: "flex", alignItems: "center" }}>
        {/* <LogoBox onClick={handleClickRoot}>
          <Image
            src={NYULOGO}
            alt="NYU logo"
            height={40}
            style={{ transform: "translateY(4px)", marginRight: 15 }}
          />
        </LogoBox> */}
        {!isRoot && (
          <LogoBox onClick={handleClickHome}>
            <img src={logo} alt={`${name} logo`} style={{ height: 40 }} />
            {!isMobile && (
              <Title as="h1">
                {name} {envTitle}
              </Title>
            )}
          </LogoBox>
        )}
      </div>
      <Box display="flex" alignItems="center">
        {!isRoot && (
          <>
            {button}
            {dropdown}
            <Divider />
          </>
        )}
        <ConfirmDialog
          callback={handleSignOut}
          message="Are you sure you want to log out?"
          title="Log Out"
        >
          <Typography
            component="p"
            color="rgba(0,0,0,0.6)"
            minWidth="50px"
            textAlign="right"
            sx={{ cursor: "pointer" }}
          >
            {netId}
          </Typography>
        </ConfirmDialog>
      </Box>
    </Nav>
  );
}
