import React, { useContext } from "react";

import { Button } from "@mui/material";
import { DatabaseContext } from "../Provider";
import { PagePermission } from "@/components/src/types";
import router from "next/router";
import useHandleStartBooking from "../../booking/hooks/useHandleStartBooking";

interface Props {
  selectedView: PagePermission;
}

export default function NavBarActionButton({ selectedView }: Props) {
  const { pagePermission } = useContext(DatabaseContext);
  const handleStartBooking = useHandleStartBooking();

  if (selectedView === PagePermission.BOOKING) {
    return (
      <Button
        onClick={() => {
          handleStartBooking();
          router.push("/media-commons/book");
        }}
        variant="outlined"
        sx={{ height: "40px", marginRight: 2 }}
      >
        Book
      </Button>
    );
  }

  if (pagePermission !== PagePermission.BOOKING) {
    return (
      <Button
        onClick={() => {
          handleStartBooking();
          router.push("/media-commons/walk-in");
        }}
        variant="outlined"
        sx={{ height: "40px", marginRight: 2 }}
      >
        Walk In
      </Button>
    );
  }
}
