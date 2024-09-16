// app/book/confirmation/page.tsx
import BookingForm from "@/components/src/client/routes/booking/BookingForm";
import BookingFormConfirmationPage from "@/components/src/client/routes/booking/formPages/BookingFormConfirmationPage";
import React from "react";

const Role: React.FC = () => (
  <BookingForm>
    <BookingFormConfirmationPage />
  </BookingForm>
);

export default Role;
