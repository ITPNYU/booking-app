// app/book/layout.tsx
import BookingForm from "@/components/src/client/routes/booking/BookingForm";
import { FormContextLevel } from "@/components/src/types";
import React from "react";

type LayoutProps = {
  children: React.ReactNode;
};

const BookingLayout: React.FC<LayoutProps> = ({ children }) => (
  <BookingForm formContext={FormContextLevel.VIP}>{children}</BookingForm>
);

export default BookingLayout;
