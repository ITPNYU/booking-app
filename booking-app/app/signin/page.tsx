"use client";

import SsoSignIn from "@/components/src/client/routes/components/SsoSignIn";
import { Suspense } from "react";

export default function SignInPage() {
  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>
        <SsoSignIn />
      </Suspense>
    </div>
  );
}
