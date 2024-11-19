// app/edit/layout.tsx
import BookingForm from "@/components/src/client/routes/booking/BookingForm";
import { FormContextLevel } from "@/components/src/types";
import React from "react";
import { Tenants } from "@/components/src/policy";

type LayoutProps = {
  children: React.ReactNode;
};

const BookingLayout: React.FC<LayoutProps> = ({ children }) => (
  <BookingForm
    formContext={FormContextLevel.EDIT}
    tenant={Tenants.MEDIA_COMMONS}
  >
    {children}
  </BookingForm>
);

export default BookingLayout;
