import { Box, Typography } from "@mui/material";
import { styled } from "@mui/system";
import React from "react";

import BookingSelection from "./BookingSelection";

const Center = styled(Box)`
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const Container = styled(Box)(({ theme }) => ({
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  borderRadius: "4px",
  border: `1px solid ${theme.palette.custom.border}` || "#e3e3e3",
}));

/** One titled block of fields on a request form step. */
export const Section = ({
  title,
  action,
  children,
}: {
  title: string;
  /** Rendered beside the title, e.g. a button that fills the section. */
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div style={{ marginBottom: "20px" }}>
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 1,
        marginBottom: "8px",
      }}
    >
      <Typography variant="h5">{title}</Typography>
      {action}
    </Box>
    <div>{children}</div>
  </div>
);

/** Bordered card shared by the Details and Services steps, headed by the current selection. */
export function RequestFormShell({ children }: { children: React.ReactNode }) {
  return (
    <Center>
      <Container padding={8} marginTop={4} marginBottom={6}>
        <BookingSelection />
        {children}
      </Container>
    </Center>
  );
}
