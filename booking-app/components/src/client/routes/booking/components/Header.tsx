import { Box, useScrollTrigger } from "@mui/material";
import { usePathname, useRouter } from "next/navigation";

import BookingFormStepper from "./Stepper";
import BookingStatusBar from "./BookingStatusBar";
import React from "react";
import { styled } from "@mui/system";

const StickyScroll = styled(Box)`
  position: -webkit-sticky;
  position: sticky;
  top: 0;
  z-index: 1000;
  background-color: white;
  padding-bottom: 20px;
  transition: box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
`;

export const Header = () => {
  const router = useRouter();
  const pathname = usePathname();

  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 100,
  });

  // /book, /walk-in, /edit/<id>
  if (/^\/(book|walk-in|edit\/[^\/]+)$/.test(pathname)) {
    return null;
  }

  const goBack = (() => {
    const match = pathname.match(
      /^(\/(book|walk-in|edit))\/(selectRoom|form)(\/[a-zA-Z0-9_-]+)?$/
    );

    if (match) {
      const [, basePath, , step, idSegment] = match;
      const id = idSegment || ""; // If there's an ID, use it; otherwise, use an empty string.

      switch (step) {
        case "selectRoom":
          return () => router.push(`${basePath}/role${id}`);
        case "form":
          return () => router.push(`${basePath}/selectRoom${id}`);
        default:
          return () => {};
      }
    } else {
      return () => {};
    }
  })();

  const goNext = (() => {
    const match = pathname.match(
      /^(\/(book|walk-in|edit))\/(selectRoom)(\/[a-zA-Z0-9_-]+)?$/
    );

    if (match) {
      const [, basePath, , step, idSegment] = match;
      const id = idSegment || ""; // If there's an ID, use it; otherwise, use an empty string.

      switch (step) {
        case "selectRoom":
          return () => router.push(`${basePath}/form${id}`);
        default:
          return () => {};
      }
    } else {
      return () => {};
    }
  })();

  // /book/form, /walk-in/form, /edit/form/<id>
  const hideNextButton =
    /^(\/(book|walk-in|edit))\/form(\/[a-zA-Z0-9_-]+)?$/.test(pathname);

  // /book/selectRoom, /book/form, /walk-in/selectRoom, /walk-in/form, /edit/selectRoom/<id>, /edit/form/<id>
  const showStatusBar =
    /^(\/(book|walk-in|edit))\/(selectRoom|form)(\/[^\/]+)?$/.test(pathname);

  return (
    <StickyScroll
      boxShadow={
        trigger
          ? "0px 2px 4px -1px rgba(0, 0, 0, 0.2), 0px 4px 5px 0px rgba(0, 0, 0, 0), 0px 1px 10px 0px rgba(0, 0, 0, 0.12)"
          : ""
      }
    >
      <div>
        <BookingFormStepper />
        {showStatusBar && (
          <BookingStatusBar {...{ goBack, goNext, hideNextButton }} />
        )}
      </div>
    </StickyScroll>
  );
};
