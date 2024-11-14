"use client";

import { Box, Toolbar, Typography } from "@mui/material";

import ConfirmDialog from "../ConfirmDialog";
import NavBarActionButton from "./NavBarActionButton";
import NavBarRoleSelect from "./NavBarRoleSelect";
import NavBarTitle from "./NavBarTitle";
import { PagePermission } from "../../../../types";
import { auth } from "@/lib/firebase/firebaseClient";
import { signOut } from "firebase/auth";
import { styled } from "@mui/system";
import { useAuth } from "../../../providers/AuthProvider";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useTenant from "../../../utils/useTenant";

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
  const tenant = useTenant();
  const { netId, setUser } = useAuth();

  const [selectedView, setSelectedView] = useState<PagePermission>(
    PagePermission.BOOKING
  );

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      console.log("Sign-out successful");
      router.push("/signin");
      setUser(null);
    } catch (error) {
      console.error("Sign-out error", error);
    }
  };

  return (
    <Nav>
      <NavBarTitle {...{ setSelectedView, tenant }} />
      <Box display="flex" alignItems="center">
        {tenant && <NavBarActionButton {...{ selectedView }} />}
        {tenant && <NavBarRoleSelect {...{ selectedView, setSelectedView }} />}
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