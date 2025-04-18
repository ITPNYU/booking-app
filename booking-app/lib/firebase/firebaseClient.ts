// firebaseClient.ts
import { getApp, getApps, initializeApp } from "firebase/app";
import { Firestore, initializeFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
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
  .then(res => res.json())
  .then(data => {
    isTestEnv = data.isOnTestEnv;
    console.log("isTestEnv", isTestEnv);
    if (!isTestEnv) {
      googleProvider.setCustomParameters({
        hd: "nyu.edu",
      });
    }
  });

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    if (!user.email?.endsWith("@nyu.edu") && !isTestEnv) {
      await auth.signOut();
      throw new Error("Only nyu.edu email addresses are allowed.");
    }
    return user;
  } catch (error) {
    console.error("Google sign-in error", error);
    throw error;
  }
};
