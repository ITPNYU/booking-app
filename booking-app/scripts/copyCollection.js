//@ts-nocheck
require("dotenv").config({ path: ".env.local" });
const admin = require("firebase-admin");

// Database names for different environments - these can be overridden
const DATABASES = {
  development: "default",
  staging: "booking-app-staging",
  production: "booking-app-prod",
};

// Parse command line arguments
const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    sourceCollection: null,
    targetCollection: null,
    sourceDatabase: "development",
    targetDatabase: "development",
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--source-collection":
        options.sourceCollection = args[++i];
        break;
      case "--target-collection":
        options.targetCollection = args[++i];
        break;
      case "--source-database":
        options.sourceDatabase = args[++i];
        break;
      case "--target-database":
        options.targetDatabase = args[++i];
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--help":
        console.log(`
Usage: node copyCollection.js [options]

Required Options:
  --source-collection <name>     Source collection name
  --target-collection <name>     Target collection name

Optional Options:
  --source-database <env>        Source database environment (default: development)
  --target-database <env>        Target database environment (default: development)
  --dry-run                      Perform a dry run without actually copying data
  --help                         Show this help message

Examples:
  node copyCollection.js --source-collection tenantSchema --target-collection tenantSchema
  node copyCollection.js --source-collection users --target-collection users
  node copyCollection.js --source-collection settings --target-collection config --source-database development --target-database production
  node copyCollection.js --source-collection tenantSchema --target-collection tenantSchema --source-database staging --target-database production
        `);
        process.exit(0);
        break;
    }
  }

  // Validate required parameters
  if (!options.sourceCollection) {
    console.error("❌ Error: --source-collection is required");
    console.error("Use --help for usage information");
    process.exit(1);
  }

  if (!options.targetCollection) {
    console.error("❌ Error: --target-collection is required");
    console.error("Use --help for usage information");
    process.exit(1);
  }

  return options;
};

// Initialize Firebase Admin for source database
const initializeSourceDb = (databaseName) => {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }

  const sourceDb = admin.firestore();

  // For the default database, don't set databaseId
  if (databaseName !== "default") {
    sourceDb.settings({
      databaseId: databaseName,
    });
  }

  return sourceDb;
};

// Initialize Firebase Admin for target database
const initializeTargetDb = (databaseName) => {
  // Create a new app instance for the target database
  const appName = `target-${databaseName}`;

  let targetApp;
  try {
    targetApp = admin.app(appName);
  } catch (error) {
    targetApp = admin.initializeApp(
      {
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      },
      appName
    );
  }

  const targetDb = targetApp.firestore();

  // For the default database, don't set databaseId
  if (databaseName !== "default") {
    targetDb.settings({
      databaseId: databaseName,
    });
  }

  return targetDb;
};

// Test database connection
const testDatabaseConnection = async (db, databaseName) => {
  try {
    console.log(`🔍 Testing connection to ${databaseName}...`);
    // Try to access a collection to test the connection
    const testCollection = db.collection("test-connection");
    await testCollection.limit(1).get();
    console.log(`✅ Successfully connected to ${databaseName}`);
    return true;
  } catch (error) {
    if (error.code === 5) {
      // NOT_FOUND
      console.log(`❌ Database ${databaseName} not found or not accessible`);
      console.log(`💡 This could mean:`);
      console.log(`   - The database doesn't exist`);
      console.log(`   - Your service account doesn't have access to it`);
      console.log(`   - The database name is incorrect`);
      console.log(`   - You need to create the database first`);
    } else if (error.code === 7) {
      // PERMISSION_DENIED
      console.log(`🚫 Permission denied for ${databaseName}`);
      console.log(`💡 This could mean:`);
      console.log(
        `   - Your service account doesn't have access to this database`
      );
      console.log(`   - You need to grant permissions to your service account`);
    } else {
      console.log(`❌ Error connecting to ${databaseName}:`, error.message);
    }
    return false;
  }
};

// Copy collection from source to target database
const copyCollection = async (
  sourceDb,
  targetDb,
  sourceCollection,
  targetCollection,
  databaseName,
  dryRun = false
) => {
  try {
    if (dryRun) {
      console.log(
        `\n🔍 [DRY RUN] Analyzing ${sourceCollection} to ${targetCollection} in ${databaseName}...`
      );
    } else {
      console.log(
        `\n🔄 Copying ${sourceCollection} to ${targetCollection} in ${databaseName}...`
      );
    }

    // Test connection first
    const canConnect = await testDatabaseConnection(targetDb, databaseName);
    if (!canConnect) {
      console.log(`⏭️  Skipping ${databaseName} due to connection issues`);
      return {
        success: false,
        copied: 0,
        errors: [`Database not accessible: ${databaseName}`],
      };
    }

    // Get all documents from source collection in source database
    const sourceSnapshot = await sourceDb.collection(sourceCollection).get();

    if (sourceSnapshot.empty) {
      console.log(
        `❌ No ${sourceCollection} documents found in source database`
      );
      return {
        success: false,
        copied: 0,
        errors: ["No source documents found"],
      };
    }

    console.log(
      `📋 Found ${sourceSnapshot.size} ${sourceCollection} documents to copy`
    );

    if (dryRun) {
      // In dry-run mode, just analyze and report what would be copied
      const documents = [];
      for (const doc of sourceSnapshot.docs) {
        const data = doc.data();
        documents.push({
          id: doc.id,
          data: data,
        });
        console.log(`  📄 Would copy document: ${doc.id}`);
      }
      console.log(
        `✅ [DRY RUN] Would copy ${sourceSnapshot.size} ${sourceCollection} documents to ${targetCollection} in ${databaseName}`
      );
      return { 
        success: true, 
        copied: sourceSnapshot.size, 
        errors: [],
        dryRun: true,
        documents: documents
      };
    }

    // Copy documents in batches to avoid transaction size limits
    const BATCH_SIZE = 500; // Firestore limit is 500 operations per batch
    let copiedCount = 0;
    let currentBatch = targetDb.batch();
    let operationsInBatch = 0;

    for (const doc of sourceSnapshot.docs) {
      const data = doc.data();
      const docRef = targetDb.collection(targetCollection).doc(doc.id);
      currentBatch.set(docRef, data);
      operationsInBatch++;
      copiedCount++;

      // Commit batch when we reach the limit
      if (operationsInBatch >= BATCH_SIZE) {
        await currentBatch.commit();
        console.log(
          `  ✓ Committed batch of ${operationsInBatch} documents (${copiedCount}/${sourceSnapshot.size})`
        );
        currentBatch = targetDb.batch();
        operationsInBatch = 0;
      }
    }

    // Commit any remaining documents
    if (operationsInBatch > 0) {
      await currentBatch.commit();
      console.log(
        `  ✓ Committed final batch of ${operationsInBatch} documents`
      );
    }

    console.log(
      `✅ Successfully copied ${copiedCount} ${sourceCollection} documents to ${targetCollection} in ${databaseName}`
    );
    return { success: true, copied: copiedCount, errors: [] };
  } catch (error) {
    console.error(
      `❌ Error copying ${sourceCollection} to ${targetCollection} in ${databaseName}:`,
      error.message
    );
    return { success: false, copied: 0, errors: [error.message] };
  }
};

// Main function
const main = async () => {
  try {
    const options = parseArgs();

    console.log("🚀 Starting collection copy process...");
    console.log(`📊 Options:`, options);
    console.log(`📊 Using database names:`, DATABASES);

    // Validate source database
    if (!DATABASES[options.sourceDatabase]) {
      console.error(`❌ Invalid source database: ${options.sourceDatabase}`);
      console.error(`Valid databases: ${Object.keys(DATABASES).join(", ")}`);
      process.exit(1);
    }

    // Validate target database
    if (!DATABASES[options.targetDatabase]) {
      console.error(`❌ Invalid target database: ${options.targetDatabase}`);
      console.error(`Valid databases: ${Object.keys(DATABASES).join(", ")}`);
      process.exit(1);
    }

    // Initialize source database
    const sourceDb = initializeSourceDb(DATABASES[options.sourceDatabase]);
    console.log(
      `📡 Connected to source database (${options.sourceDatabase} -> ${DATABASES[options.sourceDatabase]})`
    );

    // Test source database connection
    const sourceConnected = await testDatabaseConnection(
      sourceDb,
      DATABASES[options.sourceDatabase]
    );
    if (!sourceConnected) {
      console.error("💥 Cannot connect to source database. Exiting.");
      process.exit(1);
    }

    // Copy to target database
    const targetDb = initializeTargetDb(DATABASES[options.targetDatabase]);
    const result = await copyCollection(
      sourceDb,
      targetDb,
      options.sourceCollection,
      options.targetCollection,
      DATABASES[options.targetDatabase],
      options.dryRun
    );
    const results = [{ database: options.targetDatabase, ...result }];

    // Summary
    console.log("\n📊 Copy Summary:");
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    if (successful.length > 0) {
      console.log(`✅ Successful copies: ${successful.length}`);
      successful.forEach((result) => {
        console.log(
          `  - ${result.database}: ${result.copied} documents copied`
        );
      });
    }

    if (failed.length > 0) {
      console.log(`❌ Failed copies: ${failed.length}`);
      failed.forEach((result) => {
        console.log(`  - ${result.database}: ${result.errors.join(", ")}`);
      });
    }

    if (successful.length > 0) {
      console.log(`\n🎉 ${options.sourceCollection} copy process completed!`);
    } else {
      console.log(
        "\n💥 No copies were successful. Please check your database configuration."
      );
      process.exit(1);
    }
  } catch (error) {
    console.error("💥 Script failed:", error);
    process.exit(1);
  } finally {
    // Clean up Firebase app instances
    const apps = admin.apps;
    for (const app of apps) {
      if (app) {
        await app.delete();
      }
    }
  }
};

// Run the script
if (require.main === module) {
  main();
}

module.exports = { copyCollection, DATABASES };
