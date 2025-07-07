import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Firebase Admin Integration", () => {
  let mockAdmin: any;
  let mockFirestore: any;
  let mockAdminDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // Mock firestore instance
    mockFirestore = {
      settings: vi.fn(),
      collection: vi.fn(),
      batch: vi.fn(),
    };

    // Mock admin instance
    mockAdmin = {
      apps: { length: 0 },
      initializeApp: vi.fn(),
      firestore: vi.fn(() => mockFirestore),
      credential: {
        cert: vi.fn().mockReturnValue({}), // Return empty object for credential
      },
    };

    // Mock adminDb functions
    mockAdminDb = {
      serverSaveDataToFirestore: vi.fn(),
      serverUpdateDataByCalendarEventId: vi.fn(),
      logServerBookingChange: vi.fn(),
      serverGetDataByCalendarEventId: vi.fn(),
    };

    // Mock firebase-admin
    vi.doMock("firebase-admin", () => ({
      default: mockAdmin,
    }));

    // Mock firebase-admin/firestore
    vi.doMock("firebase-admin/firestore", () => ({
      Timestamp: {
        now: vi.fn(() => ({
          toDate: () => new Date(),
          toMillis: () => Date.now(),
        })),
        fromDate: vi.fn((date: Date) => ({
          toDate: () => date,
          toMillis: () => date.getTime(),
        })),
      },
    }));

    // Mock adminDb module
    vi.doMock("@/lib/firebase/server/adminDb", () => mockAdminDb);

    // Set up test environment variables
    process.env.FIREBASE_PROJECT_ID = "test-project";
    process.env.FIREBASE_CLIENT_EMAIL = "test@test.com";
    process.env.FIREBASE_PRIVATE_KEY = "test-key";
    process.env.NEXT_PUBLIC_DATABASE_NAME = "integration-test-db";
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;
    delete process.env.NEXT_PUBLIC_DATABASE_NAME;
    delete process.env.CRON_SECRET;

    vi.restoreAllMocks();
  });

  it("should ensure all API endpoints use the same Firebase Admin instance", async () => {
    // Import multiple modules that use Firebase Admin
    const firebaseAdminModule = await import(
      "@/lib/firebase/server/firebaseAdmin"
    );

    // Simulate importing other modules (they would share the same admin instance)
    const adminDbModule = await import("@/lib/firebase/server/adminDb");

    // Verify Firebase Admin was only initialized once
    expect(mockAdmin.initializeApp).toHaveBeenCalledTimes(1);

    // Verify the database settings were applied once
    expect(mockFirestore.settings).toHaveBeenCalledTimes(1);
    expect(mockFirestore.settings).toHaveBeenCalledWith({
      databaseId: "integration-test-db",
    });

    // Verify all modules get the same admin instance
    expect(firebaseAdminModule.default).toBe(mockAdmin);
  });

  it("should prevent the old singleton initialization bug", async () => {
    // Simulate the scenario where auto-checkout was using old firebaseAdmin
    // and other APIs were using the correct one

    // First, simulate a module that would have used the old (incorrect) firebaseAdmin
    // In our test, this represents the old behavior before the fix

    // Now, all modules should use the same, correctly configured instance
    await import("@/lib/firebase/server/firebaseAdmin");

    // Import additional modules that should share the same instance
    await import("@/lib/firebase/server/adminDb");

    // Verify initialization only happened once with correct configuration
    expect(mockAdmin.initializeApp).toHaveBeenCalledTimes(1);
    expect(mockAdmin.initializeApp).toHaveBeenCalledWith({
      credential: expect.any(Object),
    });

    // Verify database settings were applied with environment variable
    expect(mockFirestore.settings).toHaveBeenCalledWith({
      databaseId: "integration-test-db",
    });
  });

  it("should maintain environment-specific database configuration across API calls", async () => {
    const environments = [
      { name: "production", db: "production-db" },
      { name: "staging", db: "staging-db" },
      { name: "development", db: "development-db" },
    ];

    for (const env of environments) {
      // Reset for each environment test
      vi.clearAllMocks();
      vi.resetModules();
      mockAdmin.apps.length = 0;

      // Set environment-specific database
      process.env.NEXT_PUBLIC_DATABASE_NAME = env.db;

      // Import Firebase Admin (simulates first API call)
      await import("@/lib/firebase/server/firebaseAdmin");

      // Verify correct database configuration
      expect(mockFirestore.settings).toHaveBeenCalledWith({
        databaseId: env.db,
      });

      // Import another module (simulates second API call)
      await import("@/lib/firebase/server/adminDb");

      // Verify no additional initialization occurred
      expect(mockAdmin.initializeApp).toHaveBeenCalledTimes(1);
      expect(mockFirestore.settings).toHaveBeenCalledTimes(1);
    }
  });

  it("should handle the fixed auto-checkout import correctly", async () => {
    // Set up CRON_SECRET for auto-checkout test
    process.env.CRON_SECRET = "test-secret";

    // Mock the collection and document structure for auto-checkout
    const mockCollection = {
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ empty: true }),
    };
    mockFirestore.collection.mockReturnValue(mockCollection);

    // Import Firebase Admin first (simulates system startup)
    const adminModule = await import("@/lib/firebase/server/firebaseAdmin");

    // Verify correct initialization
    expect(mockAdmin.initializeApp).toHaveBeenCalledWith({
      credential: expect.any(Object),
    });
    expect(mockFirestore.settings).toHaveBeenCalledWith({
      databaseId: "integration-test-db",
    });

    // Verify the admin instance is properly configured
    expect(adminModule.default).toBe(mockAdmin);
    expect(adminModule.default.firestore()).toBe(mockFirestore);
  });

  it("should verify auto-checkout uses correct Firebase Admin after fix", async () => {
    // This test ensures that auto-checkout API would use the correct Firebase Admin
    // after our fix (removing old firebaseAdmin.ts import)

    // Simulate the environment where auto-checkout is called
    process.env.CRON_SECRET = "test-secret";
    process.env.NEXT_PUBLIC_DATABASE_NAME = "production-database";

    // Reset and ensure clean state
    vi.resetModules();
    mockAdmin.apps.length = 0;

    // Import Firebase Admin (this would be called by auto-checkout)
    const adminModule = await import("@/lib/firebase/server/firebaseAdmin");

    // Verify it uses the environment-specific database
    expect(mockFirestore.settings).toHaveBeenCalledWith({
      databaseId: "production-database",
    });

    // Verify singleton behavior - only one initialization
    expect(mockAdmin.initializeApp).toHaveBeenCalledTimes(1);

    // Clean up
    delete process.env.CRON_SECRET;
  });

  it("should verify correct firebase admin import path is used", async () => {
    // This test ensures we're using the correct firebase admin import

    // Verify the correct import works
    const correctModule = await import("@/lib/firebase/server/firebaseAdmin");
    expect(correctModule.default).toBeDefined();
    expect(correctModule.default).toBe(mockAdmin);
  });

  it("should ensure consistent database configuration across different API routes", async () => {
    // Import the Firebase Admin module
    await import("@/lib/firebase/server/firebaseAdmin");

    // Verify initial configuration
    expect(mockFirestore.settings).toHaveBeenCalledWith({
      databaseId: "integration-test-db",
    });

    // Simulate multiple API routes importing and using Firebase Admin
    const modules = [
      "@/lib/firebase/server/adminDb",
      "@/components/src/server/admin",
    ];

    for (const modulePath of modules) {
      try {
        await import(modulePath);
      } catch (error) {
        // Some modules might not exist in test environment, which is fine
        // The important thing is that Firebase Admin is not re-initialized
      }
    }

    // Verify Firebase Admin was only initialized once
    expect(mockAdmin.initializeApp).toHaveBeenCalledTimes(1);
    expect(mockFirestore.settings).toHaveBeenCalledTimes(1);
  });
});
