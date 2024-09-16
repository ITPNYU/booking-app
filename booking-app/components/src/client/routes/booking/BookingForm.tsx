"use client";
import React, { useEffect } from "react";
import { Header } from "./components/Header";

type BookingFormProps = {
  children: React.ReactNode;
};

export default function BookingForm({ children }: BookingFormProps) {
  useEffect(() => {
    console.log(
      "DEPLOY MODE ENVIRONMENT:",
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    );
    console.log(
      "DEPLOY MODE ENVIRONMENT:",
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    );
    console.log(
      "DEPLOY MODE ENVIRONMENT:",
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    );
    console.log(
      "DEPLOY MODE ENVIRONMENT:",
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    );
    console.log(
      "DEPLOY MODE ENVIRONMENT:",
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
    );
    console.log(
      "DEPLOY MODE ENVIRONMENT:",
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID
    );
    console.log(
      "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID:",
      process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
    );
    console.log(
      "NEXT_PUBLIC_DATABASE_NAME:",
      process.env.NEXT_PUBLIC_DATABASE_NAME
    );
  }, []);

  return (
    <div>
      <Header />
      {children}
    </div>
  );
}
