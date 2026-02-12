import { Box, Tooltip, styled } from "@mui/material";
import { useMemo } from "react";

import Chip from "@mui/material/Chip";

interface Props {
  selected?: boolean;
  disabled?: boolean;
  text: string;
  icon?: React.ElementType;
}

const RectangleChip = styled(Chip)({
  borderRadius: 4,
  height: 24,
  span: {
    padding: 6,
    fontWeight: 500,
  },
});

export default function FilterChip({
  selected = false,
  disabled = false,
  text,
  icon,
}: Props) {
  const color = useMemo(() => {
    if (disabled) {
      return "rgba(0, 0, 0, 0.19)";
    } else if (selected) {
      return "rgba(0, 0, 0, 0.87)";
    } else {
      return "rgba(0, 0, 0, 0.38)";
    }
  }, [disabled, selected]);

  const bgcolor = useMemo(() => {
    if (disabled) {
      return "rgba(33, 33, 33, 0.04)";
    } else if (selected) {
      return "rgba(33, 33, 33, 0.16)";
    } else {
      return "rgba(33, 33, 33, 0.08)";
    }
  }, [disabled, selected]);

  const Icon = icon;

  const chip = (
    <RectangleChip
      label={<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        {Icon && <Icon sx={{ fontSize: 14, color }} />}
        {text}
      </Box>}
      sx={{
        bgcolor,
        color,
        transition: "background-color 150ms, color 150ms, border 150ms",
        userSelect: "none"
      }}
    />
  );

  return chip;
}
