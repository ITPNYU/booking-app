import { Box, Step, StepLabel, Stepper } from "@mui/material";
import React, { useEffect, useMemo, useState } from "react";

import { FormContextLevel } from "@/components/src/types";
import { Tenants } from "@/components/src/policy";
import { usePathname } from "next/navigation";

interface Props {
  formContext: FormContextLevel;
  tenant: Tenants;
}

const routeToStepNames = {
  role: "Affiliation",
  selectRoom: "Select Time",
  "start-date": "Start Date",
  form: "Details",
  confirmation: "Confirmation",
};

export default function BookingFormStepper({ formContext, tenant }: Props) {
  const pathname = usePathname();
  const [activeStep, setActiveStep] = useState(0);

  const steps = useMemo(() => {
    if (tenant === Tenants.STAGING) {
      return [
        routeToStepNames["start-date"],
        routeToStepNames.form,
        routeToStepNames.confirmation,
      ];
    }
    if (formContext === FormContextLevel.MODIFICATION) {
      return [
        routeToStepNames.selectRoom,
        routeToStepNames.form,
        routeToStepNames.confirmation,
      ];
    } else {
      return [
        routeToStepNames.role,
        routeToStepNames.selectRoom,
        routeToStepNames.form,
        routeToStepNames.confirmation,
      ];
    }
  }, [pathname, formContext, tenant]);

  useEffect(() => {
    const step = pathname.split("/")[3]; // role, selectRoom, form
    const index = steps.indexOf(routeToStepNames[step]) ?? 0;
    setActiveStep(index);
  }, [pathname, formContext, tenant]);

  return (
    <Box sx={{ width: "100%", padding: 4 }}>
      <Stepper activeStep={activeStep}>
        {steps.map((label) => {
          const stepProps: { completed?: boolean } = {};
          const labelProps: {
            optional?: React.ReactNode;
          } = {};
          return (
            <Step key={label} {...stepProps}>
              <StepLabel {...labelProps}>{label}</StepLabel>
            </Step>
          );
        })}
      </Stepper>
    </Box>
  );
}
