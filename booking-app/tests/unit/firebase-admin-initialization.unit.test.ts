import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Firebase Admin Initialization", () => {
  let mockAdmin: any;
  let mockFirestore: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset modules to ensure fresh imports
    vi.resetModules();

    // Mock firebase-admin
    mockFirestore = {
      settings: vi.fn(),
    };

    mockAdmin = {
      apps: { length: 0 },
      initializeApp: vi.fn(),
      firestore: vi.fn(() => mockFirestore),
      credential: {
        cert: vi.fn().mockReturnValue({}), // Return empty object for credential
      },
    };

    vi.doMock("firebase-admin", () => ({
      default: mockAdmin,
    }));
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;
    delete process.env.NEXT_PUBLIC_DATABASE_NAME;

    vi.restoreAllMocks();
  });

  it("should initialize Firebase Admin with correct environment variables", async () => {
    // Set up environment variables
    process.env.FIREBASE_PROJECT_ID = "test-project";
    process.env.FIREBASE_CLIENT_EMAIL = "test@test.com";
    process.env.FIREBASE_PRIVATE_KEY = "test-key\\nwith-newlines";
    process.env.NEXT_PUBLIC_DATABASE_NAME = "production-db";

    // Import the firebase admin module (triggers initialization)
    await import("@/lib/firebase/server/firebaseAdmin");

    // Verify initialization was called with correct credentials
    expect(mockAdmin.initializeApp).toHaveBeenCalledWith({
      credential: expect.any(Object),
    });

    // Verify credential.cert was called with correct parameters
    expect(mockAdmin.credential.cert).toHaveBeenCalledWith({
      projectId: "test-project",
      clientEmail: "test@test.com",
      privateKey: "test-key\nwith-newlines", // Should replace \\n with \n
    });

    // Verify firestore settings were configured with correct database
    expect(mockFirestore.settings).toHaveBeenCalledWith({
      databaseId: "production-db",
    });
  });

  it("should handle missing environment variables gracefully", async () => {
    // Don't set environment variables
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Reset modules to simulate fresh import
    vi.resetModules();
    mockAdmin.apps.length = 0;

    // Make credential.cert throw an error to simulate missing credentials
    mockAdmin.credential.cert.mockImplementation(() => {
      throw new Error("Missing credentials");
    });

    // Import the firebase admin module
    await import("@/lib/firebase/server/firebaseAdmin");

    // Should handle missing env vars and log error
    expect(consoleSpy).toHaveBeenCalledWith(
      "Firebase admin initialization error",
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it("should only initialize Firebase Admin once (singleton pattern)", async () => {
    // Set up environment variables
    process.env.FIREBASE_PROJECT_ID = "test-project";
    process.env.FIREBASE_CLIENT_EMAIL = "test@test.com";
    process.env.FIREBASE_PRIVATE_KEY = "test-key";
    process.env.NEXT_PUBLIC_DATABASE_NAME = "test-db";

    // Mock that admin is already initialized
    mockAdmin.apps.length = 1;

    // Import the firebase admin module
    await import("@/lib/firebase/server/firebaseAdmin");

    // Should not call initializeApp when already initialized
    expect(mockAdmin.initializeApp).not.toHaveBeenCalled();
    expect(mockFirestore.settings).not.toHaveBeenCalled();
  });

  it("should use different database names for different environments", async () => {
    const testCases = [
      { dbName: "production-db", description: "production environment" },
      { dbName: "staging-db", description: "staging environment" },
      { dbName: "development-db", description: "development environment" },
    ];

    for (const testCase of testCases) {
      // Reset mocks for each test case
      vi.clearAllMocks();
      vi.resetModules();

      // Reset admin apps length to simulate fresh initialization
      mockAdmin.apps.length = 0;

      // Set environment variables
      process.env.FIREBASE_PROJECT_ID = "test-project";
      process.env.FIREBASE_CLIENT_EMAIL = "test@test.com";
      process.env.FIREBASE_PRIVATE_KEY = "test-key";
      process.env.NEXT_PUBLIC_DATABASE_NAME = testCase.dbName;

      // Import the firebase admin module
      await import("@/lib/firebase/server/firebaseAdmin");

      // Verify correct database name is used
      expect(mockFirestore.settings).toHaveBeenCalledWith({
        databaseId: testCase.dbName,
      });
    }
  });

  it("should properly format private key with newlines", async () => {
    // Set up environment variables with escaped newlines
    process.env.FIREBASE_PROJECT_ID = "test-project";
    process.env.FIREBASE_CLIENT_EMAIL = "test@test.com";
    process.env.FIREBASE_PRIVATE_KEY =
      "-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC\\n-----END PRIVATE KEY-----";
    process.env.NEXT_PUBLIC_DATABASE_NAME = "test-db";

    // Import the firebase admin module
    await import("@/lib/firebase/server/firebaseAdmin");

    // Verify private key newlines were properly replaced
    expect(mockAdmin.credential.cert).toHaveBeenCalledWith({
      projectId: "test-project",
      clientEmail: "test@test.com",
      privateKey:
        "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC\n-----END PRIVATE KEY-----",
    });
  });

  it("should export the correct admin instance", async () => {
    // Set up environment variables
    process.env.FIREBASE_PROJECT_ID = "test-project";
    process.env.FIREBASE_CLIENT_EMAIL = "test@test.com";
    process.env.FIREBASE_PRIVATE_KEY = "test-key";
    process.env.NEXT_PUBLIC_DATABASE_NAME = "test-db";

    // Import the firebase admin module
    const adminModule = await import("@/lib/firebase/server/firebaseAdmin");

    // Verify the default export is the admin instance
    expect(adminModule.default).toBe(mockAdmin);
  });
});
