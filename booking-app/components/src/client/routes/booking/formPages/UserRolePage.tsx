"use client";
import { Box, Button, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { useRouter } from "next/navigation";
import { useContext, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { Department, FormContextLevel, Inputs, Role } from "../../../../types";
import { useAuth } from "../../components/AuthProvider";
import { DatabaseContext } from "../../components/Provider";
import { BookingContext } from "../bookingProvider";
import { BookingFormTextField } from "../components/BookingFormInputs";
import Dropdown from "../components/Dropdown";
import { useParams } from "next/navigation";
import { useTenantSchema } from "../../components/SchemaProvider";

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

export const mapAffiliationToRole = (
  roleMapping: Record<string, string[]>,
  affiliation?: string
): Role | undefined => {
  if (!affiliation) return undefined;

  const normalizedAffiliation = affiliation.toUpperCase();

  for (const [role, affiliations] of Object.entries(roleMapping)) {
    if (affiliations.includes(normalizedAffiliation)) {
      return role as Role;
    }
  }

  return undefined;
};

const mapDepartmentCode = (
  programMapping: Record<string, string[]>,
  deptCode?: string
): Department | undefined => {
  if (!deptCode) return undefined;

  const normalizedCode = deptCode.toUpperCase();

  for (const [dept, codes] of Object.entries(programMapping)) {
    if (codes.includes(normalizedCode)) {
      return dept as Department;
    }
  }

  return Department.OTHER;
};

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
  const { userApiData } = useContext(DatabaseContext);
  const router = useRouter();
  const { user } = useAuth();
  const { tenant } = useParams();
  const tenantSchema = useTenantSchema();

  const {
    control,
    trigger,
    watch,
    formState: { errors },
  } = useForm<Inputs>({
    defaultValues: {
      ...formData,
    },
    mode: "onBlur",
  });

  const watchedFields = watch();
  const prevWatchedFieldsRef = useRef<Inputs>();
  const showOther = department === Department.OTHER;

  const isVIP = formContext === FormContextLevel.VIP;
  const isWalkIn = formContext === FormContextLevel.WALK_IN;

  // Create prefix for affiliation header
  const prefix = isVIP ? "VIP" : isWalkIn ? "Walk-In" : "";
  const affiliationTitle = prefix ? `${prefix} Affiliation` : "Affiliation";

  useEffect(() => {
    if (!user) {
      router.push("/signin");
      return;
    }

    if (userApiData && !isVIP && !isWalkIn) {
      const mappedRole = mapAffiliationToRole(
        tenantSchema.roleMapping,
        userApiData.affiliation_sub_type
      );
      const mappedDepartment = mapDepartmentCode(
        tenantSchema.programMapping,
        userApiData.reporting_dept_code
      );

      if (mappedRole && !role) {
        setRole(mappedRole);
      }

      if (mappedDepartment && !department) {
        setDepartment(mappedDepartment);
      }
    }
  }, [userApiData, user, isVIP, isWalkIn]);

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
      router.push(`/${tenant}/edit/selectRoom/${calendarEventId}`);
    } else {
      router.push(
        isWalkIn
          ? `/${tenant}/walk-in/selectRoom`
          : isVIP
            ? `/${tenant}/vip/selectRoom`
            : `/${tenant}/book/selectRoom`
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
        <Typography fontWeight={500}>{affiliationTitle}</Typography>
        <Dropdown
          value={department}
          updateValue={setDepartment}
          options={tenantSchema.programs}
          placeholder="Choose a Department"
          sx={{ marginTop: 4 }}
        />
        {showOther && (
          <BookingFormTextField
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
          options={tenantSchema.roles}
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
