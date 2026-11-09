// app/my-bookings/page.tsx

"use client";

import MyBookingsPage from "@/components/src/client/routes/myBookings/myBookingsPage";
import React, { Suspense } from "react";

const MyBookings: React.FC = () => (
  <Suspense fallback={<div>Loading...</div>}>
    <MyBookingsPage />
  </Suspense>
);

export default MyBookings;
