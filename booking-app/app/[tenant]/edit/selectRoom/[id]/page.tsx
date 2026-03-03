// app/edit/selectRoom/page.tsx

"use client";

import { FormContextLevel } from "@/components/src/types";
import React from "react";
import SelectRoomPage from "@/components/src/client/routes/booking/formPages/SelectRoomPage";

const SelectRoom = ({ params }: { params: { id: string } }) => {
  const { id } = params;
  return (
    <SelectRoomPage
      calendarEventId={id}
      formContext={FormContextLevel.EDIT}
    />
  );
};

export default SelectRoom;
