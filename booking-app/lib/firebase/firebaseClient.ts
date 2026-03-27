// firebaseClient.ts
import { isTestEnvironment } from "@/lib/utils/testEnvironment";
import { initializeApp } from "firebase/app";
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
