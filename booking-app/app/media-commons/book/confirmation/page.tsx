// app/media-commons/book/confirmation/page.tsx
import BookingFormConfirmationPage from "@/components/src/client/routes/booking/formPages/BookingFormConfirmationPage";
import { FormContextLevel } from "@/components/src/types";
import React from "react";

const Role: React.FC = () => (
  <BookingFormConfirmationPage formContext={FormContextLevel.FULL_FORM} />
);

export default Role;
