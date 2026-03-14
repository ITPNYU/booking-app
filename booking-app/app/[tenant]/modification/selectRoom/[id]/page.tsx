// app/modification/selectRoom/[id].tsx

"use client";

import { FormContextLevel } from "@/components/src/types";
import React, { use } from "react";
import SelectRoomPage from "@/components/src/client/routes/booking/formPages/SelectRoomPage";

const SelectRoom = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params);
  return (
    <SelectRoomPage
      calendarEventId={id}
      formContext={FormContextLevel.MODIFICATION}
    />
  );
};

export default SelectRoom;
