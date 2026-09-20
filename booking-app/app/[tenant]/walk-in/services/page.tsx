// app/walk-in/services/page.tsx

"use client";

import BookingFormServicesPage from "@/components/src/client/routes/booking/formPages/BookingFormServicesPage";
import { FormContextLevel } from "@/components/src/types";
import React from "react";

const Services: React.FC = () => (
  <BookingFormServicesPage formContext={FormContextLevel.WALK_IN} />
);

export default Services;
