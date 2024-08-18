import { Box, IconButton } from "@mui/material";
import { BookingStatusLabel } from "../../../../types";
import { Close } from "@mui/icons-material";
import { EventContentArg } from "@fullcalendar/core";
import React from "react";
import { styled, useTheme } from "@mui/material/styles";

export const NEW_TITLE_TAG = "Your Reservation";

interface Props {
  bgcolor: string;
  isFirst: boolean;
  isLast: boolean;
  isNew: boolean;
}

const Block = styled(Box)<Props>(
  ({ theme, bgcolor, isFirst, isLast, isNew }) => ({
    backgroundColor: bgcolor || theme.palette.primary.main,
    border: `2px solid ${bgcolor || theme.palette.primary.main}`,
    borderRadius: "4px",
    outline: "none",
    height: "100%",
    width: isNew && !isLast ? "105%" : "100%",
    overflowX: "hidden",
    cursor: bgcolor ? "unset" : "pointer",
    padding: "2px 4px",
    position: "relative",
    zIndex: isNew ? 99 : 2,
    borderTopLeftRadius: isNew && !isFirst ? 0 : 4,
    borderBottomLeftRadius: isNew && !isFirst ? 0 : 4,
  })
);

const CloseButton = styled(IconButton)(({ theme }) => ({
  position: "absolute",
  right: 0,
  top: 0,
  padding: 2,
}));

export default function CalendarEventBlock(eventInfo: EventContentArg) {
  const match = eventInfo.event.title.match(/\[(.*?)\]/);
  const title = match ? match[1] : eventInfo.event.title;
  const isNew = eventInfo.event.title === NEW_TITLE_TAG;
  const params = eventInfo.event.url
    ? eventInfo.event.url.split(":")
    : ["0", "0"];
  const index = Number(params[0]);
  const maxIndex = Number(params[1]);
  const isLast = index === maxIndex;
  const isOneColumn = index === 0 && isLast;

  const backgroundColor = () => {
    if (isNew) {
      return null;
    }
    let backgroundColor = "rgba(72, 196, 77, 1)";
    if (eventInfo.event.title.includes(BookingStatusLabel.REQUESTED)) {
      backgroundColor = "rgba(255, 122, 26, 1)";
    } else if (eventInfo.event.title.includes(BookingStatusLabel.PENDING)) {
      backgroundColor = "rgba(223, 26, 255, 1)";
    }
    return backgroundColor;
  };

  const hideTitle = isNew && index !== 0 && !isOneColumn;

  return (
    <Block
      bgcolor={backgroundColor()}
      isNew={isNew}
      isLast={isLast}
      isFirst={index === 0}
    >
      {!hideTitle && <b>{title}</b>}
      {isNew && isLast && (
        <CloseButton>
          <Close />
        </CloseButton>
      )}
    </Block>
  );
}
