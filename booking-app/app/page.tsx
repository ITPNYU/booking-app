// app/page.tsx

"use client";

import MultiTenantLandingPage from "@/components/src/client/routes/multiTenant/MultiTenantLandingPage";
import NavBar from "@/components/src/client/routes/components/navBar/NavBar";
import React from "react";

const HomePage: React.FC = () => (
  <>
    <NavBar />
    <MultiTenantLandingPage />
  </>
);

export default HomePage;
