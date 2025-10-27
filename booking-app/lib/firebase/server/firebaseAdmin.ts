import admin, { AppOptions } from "firebase-admin";

const {
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY,
  NEXT_PUBLIC_DATABASE_NAME,
} = process.env;

if (!admin.apps.length) {
  const sanitizedPrivateKey = FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const hasServiceAccount =
    Boolean(FIREBASE_CLIENT_EMAIL) && Boolean(sanitizedPrivateKey);

  const fallbackOptions: AppOptions = {
    projectId: FIREBASE_PROJECT_ID || "demo-test",
  };

  const initializationOptions: AppOptions = hasServiceAccount
    ? {
        credential: admin.credential.cert({
          projectId: FIREBASE_PROJECT_ID,
          clientEmail: FIREBASE_CLIENT_EMAIL!,
          privateKey: sanitizedPrivateKey!,
        }),
      }
    : fallbackOptions;

  if (!hasServiceAccount) {
    console.error(
      "Firebase admin initialization error",
      new Error("Missing Firebase service account credentials")
    );
  }

  try {
    admin.initializeApp(initializationOptions);
  } catch (error) {
    console.error("Firebase admin initialization error", error);
    if (!admin.apps.length) {
      admin.initializeApp(fallbackOptions);
    }
  }

  if (NEXT_PUBLIC_DATABASE_NAME) {
    try {
      admin.firestore().settings({
        databaseId: NEXT_PUBLIC_DATABASE_NAME,
      });
    } catch (error) {
      console.error("Firebase admin Firestore settings error", error);
    }
  }
}

export default admin;
