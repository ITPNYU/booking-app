import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableRow,
  useTheme,
} from "@mui/material";
import React, { useContext } from "react";

import { Add } from "@mui/icons-material";
import { DatabaseContext } from "../Provider";
import { styled } from "@mui/system";
import { useRouter } from "next/navigation";

const BottomRow = styled(Table)({
  borderTop: "none",
  borderRadius: "0px 0px 4px 4px",
  borderCollapse: "separate",
});

export default function BookMoreButton() {
  const router = useRouter();
  const theme = useTheme();
  const { reloadSafetyTrainedUsers } = useContext(DatabaseContext);

  return (
    <BottomRow>
      <TableBody>
        <TableRow>
          <TableCell sx={{ padding: "4px", borderBottom: "none" }}>
            <Button
              onClick={() => {
                reloadSafetyTrainedUsers();
                router.push("/book");
              }}
              variant="text"
              sx={{
                background: theme.palette.primary[50],
                color: theme.palette.primary.main,
                width: "100%",
              }}
            >
              <Add /> Book More
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </BottomRow>
  );
}
