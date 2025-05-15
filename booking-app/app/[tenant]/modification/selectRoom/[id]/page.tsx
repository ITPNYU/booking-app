// app/modification/selectRoom/[id].tsx

"use client";

import { FormContextLevel } from "@/components/src/types";
import React from "react";
import SelectRoomPage from "@/components/src/client/routes/booking/formPages/SelectRoomPage";

const SelectRoom: React.FC = ({ params }: { params: { id: string } }) => (
  <SelectRoomPage
    calendarEventId={params.id}
    formContext={FormContextLevel.MODIFICATION}
  />
);

export default SelectRoom;
