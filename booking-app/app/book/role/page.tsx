// app/book/form/page.tsx
import BookingForm from "@/components/src/client/routes/booking/BookingForm";
import UserRolePage from "@/components/src/client/routes/booking/formPages/UserRolePage";
import React from "react";

const Role: React.FC = () => (
  <BookingForm>
    <UserRolePage />
  </BookingForm>
);

export default Role;
