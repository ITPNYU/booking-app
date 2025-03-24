// app/book/form/page.tsx

"use client";

import BookingFormDetailsPage from "@/components/src/client/routes/booking/formPages/BookingFormDetailsPage";
import React from "react";
import { FormContextLevel } from "@/components/src/types";

const Form: React.FC = () => (
  <BookingFormDetailsPage formContext={FormContextLevel.VIP} />
);

export default Form;
