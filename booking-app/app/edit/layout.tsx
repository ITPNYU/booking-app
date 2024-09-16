// app/edit/layout.tsx
import BookingForm from "@/components/src/client/routes/booking/BookingForm";
import React from "react";

type LayoutProps = {
  children: React.ReactNode;
};

const BookingLayout: React.FC<LayoutProps> = ({ children }) => (
  <BookingForm>{children}</BookingForm>
);

export default BookingLayout;
