/** Firestore database IDs for each environment. */
export const DATABASES = {
  development: "(default)",
  staging: "booking-app-staging",
  production: "booking-app-prod",
} as const satisfies Record<string, string>;
