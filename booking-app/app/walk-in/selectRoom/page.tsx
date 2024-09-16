// app/walk-in/selectRoom/page.tsx

"use client";

import React from "react";
import SelectRoomPage from "@/components/src/client/routes/booking/formPages/SelectRoomPage";

const SelectRoom: React.FC = () => <SelectRoomPage isWalkIn={true} />;

export default SelectRoom;
