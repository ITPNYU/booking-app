// app/walk-in/confirmation/page.tsx
import BookingFormConfirmationPage from "@/components/src/client/routes/booking/formPages/BookingFormConfirmationPage";
import { FormContextLevel } from "@/components/src/types";
import React from "react";

const Role: React.FC = () => (
  <BookingFormConfirmationPage formContext={FormContextLevel.WALK_IN} />
);

export default Role;
