// app/media-commons/edit/form/[id].tsx

"use client";

import BookingFormDetailsPage from "@/components/src/client/routes/booking/formPages/BookingFormDetailsPage";
import { FormContextLevel } from "@/components/src/types";
import React from "react";
import { Tenants } from "@/components/src/policy";

const Form: React.FC = ({ params }: { params: { id: string } }) => (
  <BookingFormDetailsPage
    calendarEventId={params.id}
    formContext={FormContextLevel.EDIT}
    tenant={Tenants.MEDIA_COMMONS}
  />
);

export default Form;
