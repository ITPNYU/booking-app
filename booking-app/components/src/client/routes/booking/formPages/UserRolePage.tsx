"use client";

import { Box, Button, Typography } from "@mui/material";
import { Department, Role } from "../../../../types";
import React, { useContext, useEffect } from "react";

import { BookingContext } from "../bookingProvider";
import Dropdown from "../components/Dropdown";
import { styled } from "@mui/material/styles";
import { useAuth } from "../../components/AuthProvider";
import { useRouter } from "next/navigation";

const Center = styled(Box)`
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const Container = styled(Box)(({ theme }) => ({
  width: "50%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  borderRadius: "4px",
  border: `1px solid ${theme.palette.divider}`,
}));

interface Props {
  calendarEventId?: string;
  isWalkIn?: boolean;
}

export default function UserRolePage({
  calendarEventId,
  isWalkIn = false,
}: Props) {
  const { role, department, setDepartment, setRole } =
    useContext(BookingContext);

  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      router.push("/signin");
    }
  }, []);

  const handleNextClick = () => {
    if (!role || !department) {
      alert("Please make sure all fields are selected.");
      return;
    }
    router.push(isWalkIn ? "/walk-in/selectRoom" : "/book/selectRoom");
  };

  return (
    <Center>
      <Container padding={4} marginTop={6}>
        <Typography fontWeight={500}>Affiliation</Typography>
        <Dropdown
          value={department}
          updateValue={setDepartment}
          options={Object.values(Department)}
          placeholder="Choose a Department"
          sx={{ marginTop: 4 }}
        />
        <Dropdown
          value={role}
          updateValue={setRole}
          options={Object.values(Role)}
          placeholder="Choose a Role"
          sx={{ marginTop: 4 }}
        />
        <Button
          onClick={handleNextClick}
          variant="contained"
          color="primary"
          sx={{ marginTop: 6 }}
        >
          Next
        </Button>
      </Container>
    </Center>
  );
}
