// app/walk-in/form/page.tsx

"use client";

import BookingFormDetailsPage from "@/components/src/client/routes/booking/formPages/BookingFormDetailsPage";
import { FormContextLevel } from "@/components/src/types";
import React from "react";

const Form: React.FC = () => (
  <BookingFormDetailsPage formContext={FormContextLevel.WALK_IN} />
);

export default Form;
