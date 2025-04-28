"use client";

import React from "react";
import { notFound } from "next/navigation";
import NavBar from "@/components/src/client/routes/components/navBar";

type LayoutProps = {
  children: React.ReactNode;
  params: {
    tenant: string;
  };
};

const ALLOWED_PLATFORMS = ["mc", "itp"];

const Layout: React.FC<LayoutProps> = ({ children, params }) => {
  if (!ALLOWED_PLATFORMS.includes(params.tenant)) {
    return notFound();
  }
  return (
    <>
      {children}
    </>
  );
};

export default Layout;
