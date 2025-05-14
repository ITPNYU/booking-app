// app/book/selectRoom/page.tsx

"use client";

import React from "react";
import SelectRoomPage from "@/components/src/client/routes/booking/formPages/SelectRoomPage";
import { FormContextLevel } from "@/components/src/types";

const SelectRoom: React.FC = () => (
  <SelectRoomPage formContext={FormContextLevel.VIP} />
);

export default SelectRoom;
