// app/walk-in/selectRoom/page.tsx

"use client";

import { FormContextLevel } from "@/components/src/types";
import React from "react";
import SelectRoomPage from "@/components/src/client/routes/booking/formPages/SelectRoomPage";

const SelectRoom: React.FC = () => (
  <SelectRoomPage formContext={FormContextLevel.WALK_IN} />
);

export default SelectRoom;
