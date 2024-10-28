import { MockAuthentication } from "firebase-mock";
import { jest } from "@jest/globals";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("./lib/firebase/firebaseClient.ts", () => ({
  auth: new MockAuthentication(),
}));

jest.mock("./components/src/client/routes/components/AuthProvider.tsx", () => ({
  useAuth: {
    user: {
      email: "abc12345",
    },
    loading: false,
    error: null,
  },
}));
