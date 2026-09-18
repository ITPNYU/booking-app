// app/edit/services/[id].tsx

"use client";

import BookingFormServicesPage from "@/components/src/client/routes/booking/formPages/BookingFormServicesPage";
import { FormContextLevel } from "@/components/src/types";
import { useParams } from "next/navigation";
import React from "react";

const Services = () => {
  const { id } = useParams<{ id: string }>();
  return (
    <BookingFormServicesPage
      calendarEventId={id}
      formContext={FormContextLevel.EDIT}
    />
  );
};

export default Services;
