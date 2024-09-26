import { Box, Step, StepLabel, Stepper } from "@mui/material";
import React, { useEffect, useMemo, useState } from "react";

import { FormContextLevel } from "@/components/src/types";
import { usePathname } from "next/navigation";

interface Props {
  formContext: FormContextLevel;
}

const routeToStepNames = {
  role: "Affiliation",
  selectRoom: "Select Time",
  form: "Details",
  confirmation: "Confirmation",
};

export default function BookingFormStepper({ formContext }: Props) {
  const pathname = usePathname();
  const [activeStep, setActiveStep] = useState(0);

  const steps = useMemo(() => {
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
  }, [pathname]);

  useEffect(() => {
    const step = pathname.split("/")[2]; // role, selectRoom, form
    const index = steps.indexOf(routeToStepNames[step]) ?? 0;
    setActiveStep(index);
  }, [pathname, formContext]);

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
