import React from "react";
import { TableCell } from "@mui/material";
import { styled } from "@mui/system";

interface Props {
  topText: string;
  bottomText: string;
}

const Stacked = styled(TableCell)({
  label: {
    fontSize: "12px",
  },
});

export default function StackedTableCell({ topText, bottomText }: Props) {
  return (
    <Stacked>
      <p>{topText}</p>
      <label>{bottomText}</label>
    </Stacked>
  );
}
