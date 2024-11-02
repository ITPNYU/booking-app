"use client";

import { Box, Toolbar, Typography } from "@mui/material";
import React, { useContext, useState } from "react";

import ConfirmDialog from "../ConfirmDialog";
import { DatabaseContext } from "../Provider";
import NavBarActionButton from "./NavBarActionButton";
import NavBarRoleSelect from "./NavBarRoleSelect";
import NavBarTitle from "./NavBarTitle";
import { PagePermission } from "../../../../types";
import { auth } from "@/lib/firebase/firebaseClient";
import { signOut } from "firebase/auth";
import { styled } from "@mui/system";
import { useRouter } from "next/navigation";

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
  const { userEmail, setUserEmail } = useContext(DatabaseContext);

  const [selectedView, setSelectedView] = useState<PagePermission>(
    PagePermission.BOOKING
  );

  const netId = userEmail?.split("@")[0];

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

  return (
    <Nav>
      <NavBarTitle {...{ setSelectedView }} />
      <Box display="flex" alignItems="center">
        <NavBarActionButton {...{ selectedView }} />
        <NavBarRoleSelect {...{ selectedView, setSelectedView }} />
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
