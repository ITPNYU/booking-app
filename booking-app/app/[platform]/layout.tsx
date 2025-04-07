"use client";

import React from "react";
import { notFound } from "next/navigation";

type LayoutProps = {
  children: React.ReactNode;
  params: {
    platform: string;
  };
};

const ALLOWED_PLATFORMS = ["mc", "itp"];

const Layout: React.FC<LayoutProps> = ({ children, params }) => {
  if (!ALLOWED_PLATFORMS.includes(params.platform)) {
    return notFound();
  }
  return <>{children}</>;
};

export default Layout;
