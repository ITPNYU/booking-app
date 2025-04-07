// app/edit/form/[id].tsx

"use client";

import BookingFormDetailsPage from "@/components/src/client/routes/booking/formPages/BookingFormDetailsPage";
import { FormContextLevel } from "@/components/src/types";
import React from "react";

const Form: React.FC = ({ params }: { params: { id: string } }) => (
  <BookingFormDetailsPage
    calendarEventId={params.id}
    formContext={FormContextLevel.EDIT}
  />
);

export default Form;
