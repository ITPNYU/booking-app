// Migration script to help set up calendarProdId fields in tenant schema
// This is a template - you'll need to customize it with your actual calendar IDs

const admin = require('firebase-admin');

// Initialize Firebase Admin (you may need to provide credentials)
// admin.initializeApp({
//   credential: admin.credential.applicationDefault(),
//   projectId: 'your-project-id'
// });

const db = admin.firestore();

// Configuration: Map room IDs to their production calendar IDs
// TODO: Fill in your actual production calendar IDs
const PRODUCTION_CALENDAR_MAPPING = {
  202: 'production_calendar_for_room_202@group.calendar.google.com',
  220: 'production_calendar_for_room_220@group.calendar.google.com',
  221: 'production_calendar_for_room_221@group.calendar.google.com',
  // Add more mappings as needed
};

// Configuration: Map room IDs to their development calendar IDs
// TODO: Fill in your actual development calendar IDs (if different from current)
const DEVELOPMENT_CALENDAR_MAPPING = {
  202: 'dev_calendar_for_room_202@group.calendar.google.com',
  220: 'dev_calendar_for_room_220@group.calendar.google.com',
  221: 'dev_calendar_for_room_221@group.calendar.google.com',
  // Add more mappings as needed
};

async function migrateCalendarIds(tenantId, dryRun = true) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Migrating calendar IDs for tenant: ${tenantId}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be applied)'}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // Get the tenant schema document
    const tenantDocRef = db.collection('tenantSchema').doc(tenantId);
    const tenantDoc = await tenantDocRef.get();

    if (!tenantDoc.exists) {
      console.error(`❌ Tenant document not found: ${tenantId}`);
      return;
    }

    const data = tenantDoc.data();
    console.log(`✅ Found tenant schema for: ${data.name || tenantId}`);
    console.log(`   Resources count: ${data.resources?.length || 0}\n`);

    if (!data.resources || data.resources.length === 0) {
      console.error('❌ No resources found in tenant schema');
      return;
    }

    // Update resources with calendar IDs
    const updatedResources = data.resources.map((resource, index) => {
      const roomId = resource.roomId;
      const currentCalendarId = resource.calendarId;
      const currentProdId = resource.calendarProdId;

      console.log(`\n📍 Resource ${index + 1}: ${resource.name} (Room ${roomId})`);
      console.log(`   Current calendarId: ${currentCalendarId || 'NOT SET'}`);
      console.log(`   Current calendarProdId: ${currentProdId || 'NOT SET'}`);

      // Determine new calendar IDs
      const newDevCalendarId = DEVELOPMENT_CALENDAR_MAPPING[roomId] || currentCalendarId;
      const newProdCalendarId = PRODUCTION_CALENDAR_MAPPING[roomId] || currentProdId;

      if (!newProdCalendarId) {
        console.log(`   ⚠️  WARNING: No production calendar ID configured for room ${roomId}`);
      }

      console.log(`   → New calendarId (dev): ${newDevCalendarId}`);
      console.log(`   → New calendarProdId (prod): ${newProdCalendarId || 'NOT SET'}`);

      const updated = {
        ...resource,
        calendarId: newDevCalendarId,
      };

      // Only add calendarProdId if it's defined
      if (newProdCalendarId) {
        updated.calendarProdId = newProdCalendarId;
      }

      // Check if anything changed
      const hasChanges = 
        currentCalendarId !== newDevCalendarId || 
        currentProdId !== newProdCalendarId;

      if (hasChanges) {
        console.log(`   ✨ Changes will be applied`);
      } else {
        console.log(`   ℹ️  No changes needed`);
      }

      return updated;
    });

    console.log(`\n${'='.repeat(60)}`);
    console.log('Summary:');
    console.log(`  Total resources: ${updatedResources.length}`);
    console.log(`  Resources with production calendar: ${updatedResources.filter(r => r.calendarProdId).length}`);
    console.log(`  Resources without production calendar: ${updatedResources.filter(r => !r.calendarProdId).length}`);
    console.log(`${'='.repeat(60)}\n`);

    if (!dryRun) {
      // Apply the update
      await tenantDocRef.update({
        resources: updatedResources
      });
      console.log('✅ Calendar IDs updated successfully in Firestore!\n');
    } else {
      console.log('ℹ️  DRY RUN - No changes were made to Firestore.');
      console.log('   To apply changes, run with: dryRun = false\n');
    }

  } catch (error) {
    console.error('❌ Error updating calendar IDs:', error);
    throw error;
  }
}

// Example usage:
// migrateCalendarIds('mc', true);  // Dry run
// migrateCalendarIds('mc', false); // Apply changes

module.exports = { migrateCalendarIds };

// If running directly from command line
if (require.main === module) {
  const tenant = process.argv[2] || 'mc';
  const dryRun = process.argv[3] !== '--apply';
  
  console.log('\n🚀 Calendar ID Migration Script\n');
  
  if (!admin.apps.length) {
    console.error('❌ Firebase Admin not initialized.');
    console.error('   Please uncomment and configure the admin.initializeApp() section.');
    process.exit(1);
  }

  migrateCalendarIds(tenant, dryRun)
    .then(() => {
      console.log('\n✅ Migration script completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration script failed:', error);
      process.exit(1);
    });
}

