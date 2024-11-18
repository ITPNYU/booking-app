"use client";

import { Box, Button, Typography } from "@mui/material";
import { Department, FormContextLevel, Role } from "../../../../types";
import { useContext, useEffect, useRef } from "react";

import { BookingContext } from "../../../providers/BookingFormProvider";
import { BookingFormTextField } from "../components/BookingFormInputs";
import Dropdown from "../components/Dropdown";
import { InputsMediaCommons } from "@/components/src/typesMediaCommons";
import { styled } from "@mui/material/styles";
import { useAuth } from "../../../providers/AuthProvider";
import { useForm } from "react-hook-form";
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
  const { formData, role, department, setDepartment, setRole, setFormData } =
    useContext(BookingContext);

  const router = useRouter();
  const { user } = useAuth();

  const {
    control,
    trigger,
    watch,
    formState: { errors },
  } = useForm<InputsMediaCommons>({
    defaultValues: {
      ...formData, // restore answers if navigating between form pages
    },
    mode: "onBlur",
  });

  const watchedFields = watch();
  const prevWatchedFieldsRef = useRef<InputsMediaCommons>();

  const showOther = department === Department.OTHER;

  useEffect(() => {
    if (!user) {
      router.push("/signin");
    }
  }, []);

  useEffect(() => {
    if (
      !prevWatchedFieldsRef.current ||
      prevWatchedFieldsRef.current.otherDepartment !==
        watchedFields.otherDepartment
    ) {
      setFormData({ ...watchedFields });
      prevWatchedFieldsRef.current = watchedFields;
    }
  }, [watchedFields, setFormData]);

  const getDisabled = () => {
    if (showOther && !watchedFields.otherDepartment) {
      return true;
    }
    return !role || !department;
  };

  const handleNextClick = () => {
    if (formContext === FormContextLevel.EDIT && calendarEventId != null) {
      router.push("/media-commons/edit/selectRoom/" + calendarEventId);
    } else {
      router.push(
        formContext === FormContextLevel.WALK_IN
          ? "/media-commons/walk-in/selectRoom"
          : "/media-commons/book/selectRoom"
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
          <BookingFormTextField<InputsMediaCommons>
            id="otherDepartment"
            label="Your Department"
            containerSx={{ marginBottom: 2, marginTop: 1, width: "100%" }}
            fieldSx={{}}
            {...{ control, errors, trigger }}
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
