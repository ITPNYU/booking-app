import { Box, IconButton } from "@mui/material";

import { Close } from "@mui/icons-material";
import { EventContentArg } from "@fullcalendar/core";
import React from "react";
import { styled } from "@mui/material/styles";

export const NEW_TITLE_TAG = "Your Reservation - Click and Drag to select time";
export const UNKNOWN_BLOCK_TITLE = "Unavailable";

interface Props {
  bgcolor: string;
  isnew: boolean;
  numrooms: number;
}

const Block = styled(Box)<Props>(({ theme, bgcolor, isnew, numrooms }) => ({
  backgroundColor: bgcolor || theme.palette.primary.main,
  border: `2px solid ${bgcolor || theme.palette.primary.main}`,
  borderRadius: "4px",
  outline: "none",
  height: "100%",
  width: isnew
    ? `calc((100% + 2px) * ${numrooms} + ${numrooms - 1}px)`
    : "100%",
  overflowX: "hidden",
  cursor: bgcolor ? "unset" : "pointer",
  padding: "2px 4px",
  position: "relative",
  zIndex: isnew ? 99 : 2,
}));

const Empty = styled(Box)`
  width: "100%";
  height: "100%";
  position: relative;
`;

const CloseButton = styled(IconButton)(({ theme }) => ({
  position: "absolute",
  right: 0,
  top: 0,
  padding: 2,
}));

export default function CalendarEventBlock(eventInfo: EventContentArg) {
  const isNew = eventInfo.event.title === NEW_TITLE_TAG;
  let title = isNew ? NEW_TITLE_TAG : UNKNOWN_BLOCK_TITLE;
  if (eventInfo.event.title.trim().length === 0) {
    title = "";
  }

  const params = eventInfo.event.url
    ? eventInfo.event.url.split(":")
    : ["0", "0"];
  const index = Number(params[0]);
  const numRooms = Number(params[1]);

  const isLast = index === numRooms - 1;
  const isOneColumn = index === 0 && isLast;

  const backgroundColor = () => {
    if (isNew) {
      return null;
    }
    return "rgba(72, 196, 77, 1)";
  };

  if (isNew && index !== 0) {
    return (
      <Empty>
        {isNew && isLast && (
          <CloseButton>
            <Close />
          </CloseButton>
        )}
      </Empty>
    );
  }

  return (
    <Block bgcolor={backgroundColor()} isnew={isNew} numrooms={numRooms}>
      <b>{title}</b>
      {isNew && isOneColumn && (
        <CloseButton>
          <Close />
        </CloseButton>
      )}
    </Block>
  );
}
