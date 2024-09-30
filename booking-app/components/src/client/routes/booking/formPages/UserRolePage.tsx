"use client";

import { Box, Button, TextField, Typography } from "@mui/material";
import { Department, FormContextLevel, Role } from "../../../../types";
import React, { useContext, useEffect, useState } from "react";

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
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  borderRadius: "4px",
  border: `1px solid ${theme.palette.divider}`,
}));

interface Props {
  calendarEventId?: string;
  formContext?: FormContextLevel;
}

export default function UserRolePage({
  calendarEventId,
  formContext = FormContextLevel.FULL_FORM,
}: Props) {
  const {
    role,
    department,
    otherDepartment,
    setDepartment,
    setRole,
    setOtherDepartment,
  } = useContext(BookingContext);

  const router = useRouter();
  const { user } = useAuth();

  const showOther = department === Department.OTHER;

  useEffect(() => {
    if (!user) {
      router.push("/signin");
    }
  }, []);

  const getDisabled = () => {
    if (showOther && (!otherDepartment || otherDepartment.length === 0)) {
      return true;
    }
    return !role || !department;
  };

  const handleNextClick = () => {
    if (formContext === FormContextLevel.EDIT && calendarEventId != null) {
      router.push("/edit/selectRoom/" + calendarEventId);
    } else {
      router.push(
        formContext === FormContextLevel.WALK_IN
          ? "/walk-in/selectRoom"
          : "/book/selectRoom"
      );
    }
  };

  return (
    <Center>
      <Container
        padding={4}
        margin={3}
        marginTop={6}
        width={{ xs: "100%", md: "50%" }}
      >
        <Typography fontWeight={500}>Affiliation</Typography>
        <Dropdown
          value={department}
          updateValue={setDepartment}
          options={Object.values(Department)}
          placeholder="Choose a Department"
          sx={{ marginTop: 4 }}
        />
        {showOther && (
          <TextField
            variant="outlined"
            placeholder="Enter your department"
            value={otherDepartment}
            error={
              otherDepartment != null && otherDepartment.trim().length === 0
            }
            onError={() => setOtherDepartment("")}
            onChange={(e) => setOtherDepartment(e.target.value)}
            sx={{ marginBottom: 2, marginTop: 1 }}
            fullWidth
          />
        )}
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
          disabled={getDisabled()}
          sx={{ marginTop: 6 }}
        >
          Next
        </Button>
      </Container>
    </Center>
  );
}
