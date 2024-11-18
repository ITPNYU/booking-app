// app/media-commons/walk-in/form/page.tsx

"use client";

import BookingFormDetailsPage from "@/components/src/client/routes/booking/formPages/BookingFormDetailsPage";
import { FormContextLevel } from "@/components/src/types";
import React from "react";
import { Tenants } from "@/components/src/policy";

const Form: React.FC = () => (
  <BookingFormDetailsPage
    formContext={FormContextLevel.WALK_IN}
    tenant={Tenants.MEDIA_COMMONS}
  />
);

export default Form;
