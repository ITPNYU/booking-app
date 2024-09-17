// app/book/selectRoom/page.tsx

"use client";

import BookingForm from "@/components/src/client/routes/booking/BookingForm";
import SelectRoomPage from "@/components/src/client/routes/booking/formPages/SelectRoomPage";
import React from "react";

const SelectRoom: React.FC = () => (
  <BookingForm>
    <SelectRoomPage />
  </BookingForm>
);

export default SelectRoom;
