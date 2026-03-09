// app/modification/form/[id].tsx

"use client";

import BookingFormDetailsPage from "@/components/src/client/routes/booking/formPages/BookingFormDetailsPage";
import { FormContextLevel } from "@/components/src/types";
import { useParams } from "next/navigation";
import React from "react";

const Form = () => {
  const { id } = useParams<{ id: string }>();
  return (
    <BookingFormDetailsPage
      calendarEventId={id}
      formContext={FormContextLevel.MODIFICATION}
    />
  );
};

export default Form;
