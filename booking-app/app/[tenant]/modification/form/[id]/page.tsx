// app/modification/form/[id].tsx

"use client";

import BookingFormDetailsPage from "@/components/src/client/routes/booking/formPages/BookingFormDetailsPage";
import { FormContextLevel } from "@/components/src/types";
import React, { use } from "react";

const Form = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params);
  return (
    <BookingFormDetailsPage
      calendarEventId={id}
      formContext={FormContextLevel.MODIFICATION}
    />
  );
};

export default Form;
