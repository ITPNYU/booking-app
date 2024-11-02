// app/staging/page.tsx

"use client";

import MyBookingsPage from "@/components/src/client/routes/myBookings/myBookingsPage";
import React from "react";
import { Tenants } from "@/components/src/policy";

const HomePage: React.FC = () => <MyBookingsPage tenant={Tenants.STAGING} />;

export default HomePage;
