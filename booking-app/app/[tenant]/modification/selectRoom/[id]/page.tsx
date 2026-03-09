// app/modification/selectRoom/[id].tsx

"use client";

import { FormContextLevel } from "@/components/src/types";
import { useParams } from "next/navigation";
import React from "react";
import SelectRoomPage from "@/components/src/client/routes/booking/formPages/SelectRoomPage";

const SelectRoom = () => {
  const { id } = useParams<{ id: string }>();
  return (
    <SelectRoomPage
      calendarEventId={id}
      formContext={FormContextLevel.MODIFICATION}
    />
  );
};

export default SelectRoom;
