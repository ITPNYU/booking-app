// firebaseClient.ts
import { isTestEnvironment } from "@/lib/utils/testEnvironment";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { Firestore, initializeFirestore } from "firebase/firestore";

// Check for test environment synchronously from environment variables
const isTestEnv = isTestEnvironment();

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

// Only initialize Firebase app if not in test environment
let app: any = null;
if (!isTestEnv) {
  app = initializeApp(firebaseConfig);
} else {
  console.log("Skipping Firebase initialization in test environment");
  // Create a mock app for test environment
  app = {
    name: "test-app",
    options: firebaseConfig,
  };
}
let db: Firestore;
export const initializeDb = () => {
  if (isTestEnv) {
    // Return a mock database for test environment
    console.log("Using mock database in test environment");
    return {
      collection: () => ({
        doc: () => ({
          get: () => Promise.resolve({ exists: false, data: () => ({}) }),
          set: () => Promise.resolve(),
          update: () => Promise.resolve(),
          delete: () => Promise.resolve(),
        }),
        add: () => Promise.resolve({ id: "mock-doc-id" }),
        where: () => ({
          get: () => Promise.resolve({ docs: [] }),
        }),
        get: () => Promise.resolve({ docs: [] }),
      }),
    } as any;
  }

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

let authInstance: any = null;
let providerInstance: any = null;

// Initialize Firebase Auth conditionally
if (!isTestEnv) {
  authInstance = getAuth(app);
  providerInstance = new GoogleAuthProvider();
} else {
  // Create mock auth for test environment
  authInstance = {
    currentUser: null,
    onAuthStateChanged: (callback: any) => {
      setTimeout(() => callback(null), 0);
      return () => {};
    },
    signOut: () => Promise.resolve(),
  };
  providerInstance = null;
}

export const auth = authInstance;
export const googleProvider = providerInstance;

let dynamicTestEnv = isTestEnv; // Start with the environment check

// Only fetch from API if we're not already in test environment and we have a valid base URL
if (
  !isTestEnv &&
  process.env.NEXT_PUBLIC_BASE_URL &&
  typeof window !== "undefined"
) {
  fetch(process.env.NEXT_PUBLIC_BASE_URL + "/api/isTestEnv")
    .then((res) => res.json())
    .then((data) => {
      dynamicTestEnv = data.isOnTestEnv;
      console.log("dynamicTestEnv", dynamicTestEnv);
      if (!dynamicTestEnv && googleProvider) {
        googleProvider.setCustomParameters({
          hd: "nyu.edu",
        });
      }
    })
    .catch((error) => {
      console.log(
        "Failed to fetch isTestEnv, using environment check:",
        isTestEnv
      );
      dynamicTestEnv = isTestEnv;
    });
}

// Check if running on localhost
const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

export const signInWithGoogle = async () => {
  // In test environment, return a mock user instead of trying to sign in
  if (isTestEnv) {
    return {
      uid: "test-user-id",
      email: "test@nyu.edu",
      displayName: "Test User",
      photoURL: null,
      emailVerified: true,
    };
  }

  try {
    if (isLocalhost) {
      // Use popup for localhost to avoid cross-domain issues
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      if (!user.email?.endsWith("@nyu.edu") && !dynamicTestEnv) {
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
  // In test environment, always return null (no redirect result)
  if (isTestEnv) {
    return null;
  }

  if (isLocalhost) {
    // No redirect result for localhost (popup is used)
    return null;
  }

  try {
    const result = await getRedirectResult(auth);
    if (result) {
      const user = result.user;
      if (!user.email?.endsWith("@nyu.edu") && !dynamicTestEnv) {
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
