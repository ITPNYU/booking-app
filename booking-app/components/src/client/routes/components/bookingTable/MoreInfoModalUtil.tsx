import { TableCell, Typography } from "@mui/material";

import { styled } from "@mui/system";

export const ModalSectionTitle = styled(Typography)({
  fontWeight: 700,
});
ModalSectionTitle.defaultProps = {
  variant: "subtitle1",
};

export const ModalLabelCell = styled(TableCell)(({ theme }) => ({
  borderRight: `1px solid ${theme.palette.custom.border}`,
  width: 175,
  verticalAlign: "top",
}));

export const MODAL_BLANK = "None";
