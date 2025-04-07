// app/book/page.tsx

"use client";

import WalkInLandingPage from "@/components/src/client/routes/walk-in/WalkInLandingPage";
import { FormContextLevel } from "@/components/src/types";
import React from "react";

const VIPHomePage: React.FC = () => <WalkInLandingPage formContext={FormContextLevel.VIP} />;

export default VIPHomePage;
