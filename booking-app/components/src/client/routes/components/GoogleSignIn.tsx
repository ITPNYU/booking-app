"use client";
import React, { useContext, useEffect } from "react"; // Added this line
import { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider, signInWithGoogle, getGoogleRedirectResult } from "@/lib/firebase/firebaseClient";
import { useRouter } from "next/navigation";
import { Box, Button, styled } from "@mui/material";
import { useAuth } from "./AuthProvider";

const Center = styled(Box)`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`;
const GoogleSignIn = () => {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { isOnTestEnv } = useAuth();
  
  // Check for redirect result when component mounts
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const user = await getGoogleRedirectResult();
        if (user) {
          console.log("Google sign-in successful", user);
          router.push("/");
        }
      } catch (error: any) {
        setError(error.message || "Google sign-in failed. Please try again.");
        console.error("Google sign-in error", error);
      }
    };
    
    handleRedirectResult();
  }, [router]);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      // User will be redirected to Google login page
      // After signing in, they'll be redirected back to the app
      // and the useEffect above will handle the result
    } catch (error) {
      setError("Google sign-in failed. Please try again.");
      console.error("Google sign-in error", error);
    }
  };

  return (
    <div>
      <Center>
        <Button
          variant="contained"
          color="primary"
          onClick={handleGoogleSignIn}
          sx={{
            alignSelf: "center",
            marginTop: 6,
          }}
        >
          Sign in with NYU Google Account
        </Button>
        <p>You'll be redirected to NYU login page to sign in.</p>
        {error && <p style={{ color: "red" }}>{error}</p>}
      </Center>
    </div>
  );
};

export default GoogleSignIn;
