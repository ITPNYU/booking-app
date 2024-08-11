// app/edit/confirmation/[id].tsx
import BookingFormConfirmationPage from "@/components/src/client/routes/booking/formPages/BookingFormConfirmationPage";
import React from "react";

const Role: React.FC = ({ params }: { params: { id: string } }) => (
  <BookingFormConfirmationPage />
);

export default Role;
