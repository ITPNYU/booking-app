// app/edit/selectRoom/page.tsx

"use client";

import React from "react";
import SelectRoomPage from "@/components/src/client/routes/booking/formPages/SelectRoomPage";

const SelectRoom: React.FC = ({ params }: { params: { id: string } }) => (
  <SelectRoomPage isEdit={true} />
);

export default SelectRoom;
