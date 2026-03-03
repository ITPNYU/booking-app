// app/edit/form/[id].tsx

"use client";

import BookingFormDetailsPage from "@/components/src/client/routes/booking/formPages/BookingFormDetailsPage";
import { FormContextLevel } from "@/components/src/types";
import React from "react";

const Form = ({ params }: { params: { id: string } }) => {
  const { id } = params;
  return (
    <BookingFormDetailsPage
      calendarEventId={id}
      formContext={FormContextLevel.EDIT}
    />
  );
};

export default Form;
