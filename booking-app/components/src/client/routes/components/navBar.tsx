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
import React, { useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import ConfirmDialog from "./ConfirmDialog";
import { DatabaseContext } from "./Provider";
import Image from "next/image";
import { PagePermission } from "../../../types";
import SVGLOGO from "../../../../../public/mediaCommonsLogo.svg";
import { auth } from "@/lib/firebase/firebaseClient";
import { signOut } from "firebase/auth";
import { styled } from "@mui/system";
import useHandleStartBooking from "../booking/hooks/useHandleStartBooking";

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
  border: `1px solid ${theme.palette.custom.border}`,
  justifyContent: "space-between",
}));

const Divider = styled(Box)(({ theme }) => ({
  width: "2px",
  height: "32px",
  background: theme.palette.custom.gray,
  margin: "0px 20px",
}));

export default function NavBar() {
  const router = useRouter();
  const { pagePermission, userEmail, setUserEmail } =
    useContext(DatabaseContext);
  const handleStartBooking = useHandleStartBooking();
  const [selectedView, setSelectedView] = useState<PagePermission>(
    PagePermission.BOOKING
  );
  const pathname = usePathname();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const netId = userEmail?.split("@")[0];

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

  const handleClickHome = () => {
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

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      console.log("Sign-out successful");
      router.push("/signin");
      setUserEmail(null);
    } catch (error) {
      console.error("Sign-out error", error);
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

  const button = useMemo(() => {
    if (selectedView === PagePermission.BOOKING) {
      return (
        <Button
          onClick={() => {
            handleStartBooking();
            router.push("/media-commons/book");
          }}
          variant="outlined"
          sx={{ height: "40px", marginRight: 2 }}
        >
          Book
        </Button>
      );
    }

    if (pagePermission !== PagePermission.BOOKING) {
      return (
        <Button
          onClick={() => {
            handleStartBooking();
            router.push("/media-commons/walk-in");
          }}
          variant="outlined"
          sx={{ height: "40px", marginRight: 2 }}
        >
          Walk In
        </Button>
      );
    }
  }, [pagePermission, selectedView]);

  return (
    <Nav>
      <LogoBox onClick={handleClickHome}>
        <Image src={SVGLOGO} alt="Media Commons logo" height={40} />
        {!isMobile && <Title as="h1">Media Commons {envTitle}</Title>}
      </LogoBox>
      <Box display="flex" alignItems="center">
        {button}
        {dropdown}
        <Divider />
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
