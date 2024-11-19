import { Box, useScrollTrigger } from "@mui/material";

import BookingFormStepper from "./Stepper";
import BookingStatusBar from "./BookingStatusBar";
import { FormContextLevel } from "@/components/src/types";
import { Tenants } from "@/components/src/policy";
import { styled } from "@mui/system";
import useBookingFormNavMediaCommons from "../../mediaCommons/formPages/hooks/useBookingFormNavMediaCommons";
import useBookingFormNavStaging from "../../staging/formPages/hooks/useBookingFormNavStaging";
import { usePathname } from "next/navigation";

const StickyScroll = styled(Box)`
  position: -webkit-sticky;
  position: sticky;
  top: 0;
  z-index: 1000;
  background-color: white;
  padding-bottom: 20px;
  transition: box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
`;

interface Props {
  formContext: FormContextLevel;
  tenant: Tenants;
}

export const BookingFormHeader = ({ formContext, tenant }: Props) => {
  const pathname = usePathname();

  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 100,
  });

  // /book, /walk-in, /edit/<id>, /modification/<id>
  if (/^\/(book|walk-in|(?:edit|modification)\/[^\/]+)$/.test(pathname)) {
    return null;
  }

  const mediaCommonsNav = useBookingFormNavMediaCommons(formContext);
  const stagingNav = useBookingFormNavStaging(formContext);

  const { goBack, goNext, hideNextButton, hideBackButton, showStatusBar } =
    (() => {
      switch (tenant) {
        case Tenants.MEDIA_COMMONS:
          return mediaCommonsNav;
        case Tenants.STAGING:
          return stagingNav;
      }
    })();

  return (
    <StickyScroll
      boxShadow={
        trigger
          ? "0px 2px 4px -1px rgba(0, 0, 0, 0.2), 0px 4px 5px 0px rgba(0, 0, 0, 0), 0px 1px 10px 0px rgba(0, 0, 0, 0.12)"
          : ""
      }
    >
      <div>
        <BookingFormStepper formContext={formContext} tenant={tenant} />
        {showStatusBar && (
          <BookingStatusBar
            {...{
              goBack,
              goNext,
              hideNextButton,
              hideBackButton,
              formContext,
              tenant,
            }}
          />
        )}
      </div>
    </StickyScroll>
  );
};
