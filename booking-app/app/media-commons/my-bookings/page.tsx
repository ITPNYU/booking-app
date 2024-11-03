// app/my-bookings/page.tsx

"use client";

import MyBookingsPage from "@/components/src/client/routes/myBookings/myBookingsPage";
import React from "react";
import { Tenants } from "@/components/src/policy";

const MyBookings: React.FC = () => (
  <MyBookingsPage tenant={Tenants.MEDIA_COMMONS} />
);

export default MyBookings;
