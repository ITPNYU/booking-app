import {
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableRow,
  useTheme,
} from "@mui/material";

import { Add } from "@mui/icons-material";
import { styled } from "@mui/system";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import useHandleStartBooking from "../../booking/hooks/useHandleStartBooking";
const BottomRow = styled(Table)({
  borderTop: "none",
  borderRadius: "0px 0px 4px 4px",
  borderCollapse: "separate",
});

export default function BookMoreButton() {
  const router = useRouter();
  const theme = useTheme();
  const { tenant } = useParams();
  const handleStartBooking = useHandleStartBooking();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = () => {
    setIsLoading(true);
    handleStartBooking();
    router.push(`/${tenant}/book`);
  };

  return (
    <BottomRow>
      <TableBody>
        <TableRow>
          <TableCell sx={{ padding: "4px", borderBottom: "none" }}>
            <Button
              onClick={handleClick}
              variant="text"
              disabled={isLoading}
              sx={{
                background: theme.palette.primary[50],
                color: theme.palette.primary.main,
                width: "100%",
              }}
            >
              {isLoading ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  Loading...
                </>
              ) : (
                <>
                  <Add /> Request a Reservation
                </>
              )}
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </BottomRow>
  );
}
