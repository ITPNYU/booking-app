// app/edit/form/[id].tsx

"use client";

import BookingFormDetailsPage from "@/components/src/client/routes/booking/formPages/BookingFormDetailsPage";
import React from "react";

const Form: React.FC = ({ params }: { params: { id: string } }) => (
  <BookingFormDetailsPage />
);

export default Form;
