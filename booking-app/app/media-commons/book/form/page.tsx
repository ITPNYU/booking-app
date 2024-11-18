// app/media-commons/book/form/page.tsx

"use client";

import BookingFormDetailsPage from "@/components/src/client/routes/booking/formPages/BookingFormDetailsPage";
import React from "react";
import { Tenants } from "@/components/src/policy";

const Form: React.FC = () => (
  <BookingFormDetailsPage tenant={Tenants.MEDIA_COMMONS} />
);

export default Form;
