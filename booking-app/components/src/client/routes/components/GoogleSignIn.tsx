"use client";
import React from "react"; // Added this line
import { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase/firebaseClient";
import { useRouter } from "next/navigation";
import { Box, Button, styled } from "@mui/material";

const Center = styled(Box)`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`;
const GoogleSignIn = () => {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      if (user.email?.endsWith("@nyu.edu")) {
        console.log("Google sign-in successful", user);
        router.push("/");
      } else {
        await auth.signOut();
        setError("Only nyu.edu email addresses are allowed.");
      }
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
        <p>You must enable pop-ups for this site in order to login.</p>
        {error && <p style={{ color: "red" }}>{error}</p>}
      </Center>
    </div>
  );
};

export default GoogleSignIn;
