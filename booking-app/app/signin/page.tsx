"use client";
import GoogleSignIn from "@/components/src/client/routes/components/GoogleSignIn";
import { Suspense } from "react";

export default function SignInPage() {
  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>
        <GoogleSignIn />
      </Suspense>
    </div>
  );
}
