import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableRow,
  useTheme,
} from "@mui/material";

import { Add } from "@mui/icons-material";
import React from "react";
import { styled } from "@mui/system";
import useHandleStartBooking from "../../booking/hooks/useHandleStartBooking";
import { useRouter } from "next/navigation";

const BottomRow = styled(Table)({
  borderTop: "none",
  borderRadius: "0px 0px 4px 4px",
  borderCollapse: "separate",
});

export default function BookMoreButton() {
  const router = useRouter();
  const theme = useTheme();
  const handleStartBooking = useHandleStartBooking();

  return (
    <BottomRow>
      <TableBody>
        <TableRow>
          <TableCell sx={{ padding: "4px", borderBottom: "none" }}>
            <Button
              onClick={() => {
                handleStartBooking();
                router.push("/media-commons/book");
              }}
              variant="text"
              sx={{
                background: theme.palette.primary[50],
                color: theme.palette.primary.main,
                width: "100%",
              }}
            >
              <Add /> Request a Reservation
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </BottomRow>
  );
}
