import "@testing-library/jest-dom";

// Mock Firebase configuration to prevent errors during testing
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "fake-api-key";
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "fake-domain.firebaseapp.com";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "fake-project-id";
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "fake-bucket.appspot.com";
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "123456789";
process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "fake-app-id";

// Mock global fetch for isTestEnv endpoint
global.fetch = vi.fn((url) => {
  if (url?.toString().includes("/api/isTestEnv")) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ isTestEnv: true }),
    });
  }
  return Promise.reject(new Error("Not mocked"));
});

// Mock Firebase Auth
vi.mock("firebase/auth", () => ({
  getAuth: () => ({}),
  GoogleAuthProvider: class {
    addScope() {}
    setCustomParameters() {}
  },
}));

// Mock Firebase Firestore
vi.mock("firebase/firestore", () => ({
  getFirestore: () => ({}),
  Timestamp: {
    now: () => ({ toDate: () => new Date(), toMillis: () => Date.now() }),
    fromDate: (date: Date) => ({
      toDate: () => date,
      toMillis: () => date.getTime(),
    }),
  },
}));

// Global vi import for the setup file
import { vi } from "vitest";
