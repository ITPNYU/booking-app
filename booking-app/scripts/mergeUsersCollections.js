// Load environment variables
require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    // Check if we have the required environment variables
    if (!process.env.FIREBASE_PROJECT_ID) {
      console.error('FIREBASE_PROJECT_ID environment variable is required');
      console.log('Setting default project ID from .firebaserc...');
      process.env.FIREBASE_PROJECT_ID = 'flowing-mantis-389917';
    }
    
    let credential;
    
    if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      // Use service account credentials
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      });
    } else {
      // Try to use application default credentials (Firebase CLI)
      console.log('Service account credentials not found, trying application default credentials...');
      credential = admin.credential.applicationDefault();
    }
    
    admin.initializeApp({
      credential: credential,
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
    
    if (process.env.NEXT_PUBLIC_DATABASE_NAME) {
      admin.firestore().settings({
        databaseId: process.env.NEXT_PUBLIC_DATABASE_NAME,
      });
    }
  } catch (error) {
    console.error('Firebase admin initialization error', error);
    console.error('');
    console.error('To fix this, either:');
    console.error('1. Create a .env.local file with FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY');
    console.error('2. Run "firebase login" and "gcloud auth application-default login"');
    process.exit(1);
  }
}

const db = admin.firestore();

// Helper function to get tenant-specific collection name
const getTenantCollectionName = (baseCollection, tenant) => {
  if (!tenant) {
    return baseCollection;
  }
  
  // Collections that should be tenant-specific
  const tenantSpecificCollections = [
    'bookings',
    'bookingLogs', 
    'bookingTypes',
    'blackoutPeriods',
    'counters',
    'operationHours',
    'preBanLogs',
    'usersWhitelist',
    'usersApprovers'
  ];
  
  if (tenantSpecificCollections.includes(baseCollection)) {
    return `${tenant}-${baseCollection}`;
  }
  
  return baseCollection;
};

async function mergeUsersCollections(tenant = null) {
  try {
    console.log('Starting merge of user collections...');
    
    // Get collection names
    const usersAdminCollection = getTenantCollectionName('usersAdmin', tenant);
    const usersPaCollection = getTenantCollectionName('usersPa', tenant);
    const usersSuperAdminCollection = getTenantCollectionName('usersSuperAdmin', tenant);
    const usersRightCollection = getTenantCollectionName('mc-usersRights', tenant);
    
    console.log(`Collections to merge:`);
    console.log(`- Source: ${usersAdminCollection}`);
    console.log(`- Source: ${usersPaCollection}`);
    console.log(`- Source: ${usersSuperAdminCollection}`);
    console.log(`- Target: ${usersRightCollection}`);
    
    // Map to store merged users by email (for deduplication)
    const mergedUsers = new Map();
    // Map to store document IDs for each email
    const emailToDocIds = new Map();
    
    // Process usersAdmin collection
    console.log('\nProcessing usersAdmin collection...');
    const usersAdminSnapshot = await db.collection(usersAdminCollection).get();
    let adminCount = 0;
    
    usersAdminSnapshot.forEach(doc => {
      const userData = doc.data();
      const email = userData.email;
      
      if (!email) {
        console.warn(`Warning: Document ${doc.id} in usersAdmin has no email field`);
        return;
      }
      
      if (mergedUsers.has(email)) {
        // User already exists, add isAdmin field
        mergedUsers.get(email).isAdmin = true;
      } else {
        // New user, create entry with isAdmin field
        mergedUsers.set(email, {
          ...userData,
          isAdmin: true,
          isLiaison: true, // All users are liaisons
          isEquipment: true,
          isStaffing: true,
          isWorker: true
        });
        // Store the first document ID we encounter for this email
        emailToDocIds.set(email, doc.id);
      }
      adminCount++;
    });
    
    console.log(`Processed ${adminCount} users from usersAdmin`);
    
    // Process usersPa collection
    console.log('\nProcessing usersPa collection...');
    const usersPaSnapshot = await db.collection(usersPaCollection).get();
    let paCount = 0;
    
    usersPaSnapshot.forEach(doc => {
      const userData = doc.data();
      const email = userData.email;
      
      if (!email) {
        console.warn(`Warning: Document ${doc.id} in usersPa has no email field`);
        return;
      }
      
      if (mergedUsers.has(email)) {
        // User already exists, ensure isLiaison is true
        mergedUsers.get(email).isLiaison = true;
      } else {
        // New user, create entry with isLiaison field
        mergedUsers.set(email, {
          ...userData,
          isAdmin: false,  // Default to false
          isLiaison: true, // All users are liaisons
          isEquipment: true,
          isStaffing: true,
          isWorker: true
        });
        // Store the document ID for this email
        emailToDocIds.set(email, doc.id);
      }
      paCount++;
    });
    
    console.log(`Processed ${paCount} users from usersPa`);
    
    // Process usersSuperAdmin collection
    console.log('\nProcessing usersSuperAdmin collection...');
    console.log('Note: Super admin users are not stored in usersRights collection');
    console.log('They will be fetched directly from usersSuperAdmin collection');
    const usersSuperAdminSnapshot = await db.collection(usersSuperAdminCollection).get();
    let superAdminCount = 0;
    
    usersSuperAdminSnapshot.forEach(doc => {
      const userData = doc.data();
      const email = userData.email;
      
      if (!email) {
        console.warn(`Warning: Document ${doc.id} in usersSuperAdmin has no email field`);
        return;
      }
      
      // Super admin users are not stored in usersRights collection
      // They will be fetched directly from usersSuperAdmin collection
      console.log(`Skipping super admin user ${email} - will be fetched from original collection`);
      superAdminCount++;
    });
    
    console.log(`Processed ${superAdminCount} super admin users (not stored in usersRights)`);
    
    // Write merged users to usersRight collection
    console.log('\nWriting merged users to usersRight collection...');
    const batch = db.batch();
    let writeCount = 0;
    
    for (const [email, userData] of mergedUsers) {
      // Use the original document ID instead of email
      const originalDocId = emailToDocIds.get(email);
      const docRef = db.collection(usersRightCollection).doc(originalDocId);
      batch.set(docRef, userData);
      writeCount++;
    }
    
    await batch.commit();
    
    console.log(`\nMerge completed successfully!`);
    console.log(`Total unique users processed: ${mergedUsers.size}`);
    console.log(`Users written to ${usersRightCollection}: ${writeCount}`);
    
    // Print summary of user types
    const adminUsers = Array.from(mergedUsers.values()).filter(user => user.isAdmin).length;
    const liaisonUsers = Array.from(mergedUsers.values()).filter(user => user.isLiaison).length;
    
    console.log('\nUser type summary:');
    console.log(`- Admin users: ${adminUsers}`);
    console.log(`- Liaison users: ${liaisonUsers}`);
    console.log(`- Super admin users: ${superAdminCount} (stored in original collection)`);
    console.log(`- Users with multiple roles: ${Array.from(mergedUsers.values()).filter(user => 
      (user.isAdmin ? 1 : 0) + (user.isLiaison ? 1 : 0) > 1
    ).length}`);
    
  } catch (error) {
    console.error('Error during merge:', error);
    process.exit(1);
  }
}

// Main execution
async function main() {
  const tenant = process.argv[2] || null;
  
  if (tenant) {
    console.log(`Running merge for tenant: ${tenant}`);
  } else {
    console.log('Running merge for default collections (no tenant)');
  }
  
  await mergeUsersCollections(tenant);
  
  console.log('\nScript completed. Exiting...');
  process.exit(0);
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { mergeUsersCollections };
