import admin from "firebase-admin";

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
    admin.firestore().settings({
      databaseId: process.env.NEXT_PUBLIC_DATABASE_NAME,
    });
  } catch (error) {
    console.error("Firebase admin initialization error", error);
  }
}

export default admin;
