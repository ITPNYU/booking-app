// firebaseClient.ts
import { initializeApp } from "firebase/app";
import {
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { Firestore, initializeFirestore } from "firebase/firestore";


const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:
    process.env.NEXT_PUBLIC_BRANCH_NAME === "production"
      ? "flowing-mantis-389917.uc.r.appspot.com"
      : process.env.NEXT_PUBLIC_BRANCH_NAME === "staging"
        ? "staging-dot-flowing-mantis-389917.uc.r.appspot.com"
        : process.env.NEXT_PUBLIC_BRANCH_NAME === "development"
          ? "development-dot-flowing-mantis-389917.uc.r.appspot.com"
          : process.env.NEXT_PUBLIC_BRANCH_NAME === "development-local"
            ? process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
            : process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,

  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_MEASUREMENT_ID,
};
const app = initializeApp(firebaseConfig);
let db: Firestore;
export const initializeDb = () => {
  const options: any = {
    experimentalForceLongPolling: true,
    experimentalAutoDetectLongPolling: false,
  };

  db = initializeFirestore(app, options, process.env.NEXT_PUBLIC_DATABASE_NAME);
  return db;
};
export const getDb = () => {
  if (!db) {
    initializeDb();
  }
  return db;
};
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

let isTestEnv = false;
fetch(process.env.NEXT_PUBLIC_BASE_URL + "/api/isTestEnv")
  .then((res) => res.json())
  .then((data) => {
    isTestEnv = data.isOnTestEnv;
    console.log("isTestEnv", isTestEnv);
    if (!isTestEnv) {
      googleProvider.setCustomParameters({
        hd: "nyu.edu",
      });
    }
  });

// Check if running on localhost
const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

export const signInWithGoogle = async () => {
  try {
    if (isLocalhost) {
      // Use popup for localhost to avoid cross-domain issues
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      if (!user.email?.endsWith("@nyu.edu") && !isTestEnv) {
        await auth.signOut();
        throw new Error("Only nyu.edu email addresses are allowed.");
      }
      return user;
    } else {
      // Use redirect for deployed environments
      await signInWithRedirect(auth, googleProvider);
      // No return here, as the page will redirect
    }
  } catch (error) {
    console.error("Google sign-in error", error);
    throw error;
  }
};

export const getGoogleRedirectResult = async () => {
  if (isLocalhost) {
    // No redirect result for localhost (popup is used)
    return null;
  }
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      const user = result.user;
      if (!user.email?.endsWith("@nyu.edu") && !isTestEnv) {
        await auth.signOut();
        throw new Error("Only nyu.edu email addresses are allowed.");
      }
      return user;
    }
    return null;
  } catch (error) {
    console.error("Google redirect result error", error);
    throw error;
  }
};
