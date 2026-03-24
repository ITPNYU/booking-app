const TENANT_SCHEMA_COLLECTION = "tenantSchema";
const TENANT_SCHEMA_BACKUP_COLLECTION = "tenantSchemaBackup";

const createBackupDocId = (tenantId, backupType) => {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .replace("Z", "");
  return `${tenantId}-backup-${backupType}-${timestamp}`;
};

const backupTenantSchemaDocument = async (
  db,
  tenantId,
  existingSchema,
  backupType
) => {
  const backupDocId = createBackupDocId(tenantId, backupType);
  const backupDocRef = db
    .collection(TENANT_SCHEMA_BACKUP_COLLECTION)
    .doc(backupDocId);

  await backupDocRef.set(existingSchema, { merge: false });
  return {
    backupDocId,
    backupCollection: TENANT_SCHEMA_BACKUP_COLLECTION,
  };
};

const backupTenantSchemaCollection = async (
  targetDb,
  databaseName,
  backupType,
  dryRun = false,
  docIds = []
) => {
  try {
    let docs;
    if (docIds.length > 0) {
      const docRefs = docIds.map((id) =>
        targetDb.collection(TENANT_SCHEMA_COLLECTION).doc(id)
      );
      const docSnapshots = await targetDb.getAll(...docRefs);
      docs = docSnapshots.filter((snap) => snap.exists);
    } else {
      const targetSnapshot = await targetDb
        .collection(TENANT_SCHEMA_COLLECTION)
        .get();
      docs = targetSnapshot.docs;
    }

    if (docs.length === 0) {
      console.log(`ℹ️ No existing ${TENANT_SCHEMA_COLLECTION} documents to back up`);
      return { success: true, copied: 0, errors: [] };
    }

    if (dryRun) {
      console.log(
        `\n🔍 [DRY RUN] Would back up ${docs.length} ${TENANT_SCHEMA_COLLECTION} document(s) in ${databaseName} to ${TENANT_SCHEMA_BACKUP_COLLECTION}`
      );
      docs.forEach((doc) => {
        const backupDocId = createBackupDocId(doc.id, backupType);
        console.log(
          `  📄 Would create backup document: ${TENANT_SCHEMA_BACKUP_COLLECTION}/${backupDocId}`
        );
      });
      return { success: true, copied: docs.length, errors: [] };
    }

    console.log(
      `\n📦 Backing up ${docs.length} ${TENANT_SCHEMA_COLLECTION} document(s) in ${databaseName} to ${TENANT_SCHEMA_BACKUP_COLLECTION}...`
    );

    let copiedCount = 0;
    let currentBatch = targetDb.batch();
    let operationsInBatch = 0;
    const BATCH_SIZE = 500;

    for (const doc of docs) {
      const backupDocId = createBackupDocId(doc.id, backupType);
      const backupDocRef = targetDb
        .collection(TENANT_SCHEMA_BACKUP_COLLECTION)
        .doc(backupDocId);
      currentBatch.set(backupDocRef, doc.data(), { merge: false });
      operationsInBatch++;
      copiedCount++;

      if (operationsInBatch >= BATCH_SIZE) {
        await currentBatch.commit();
        currentBatch = targetDb.batch();
        operationsInBatch = 0;
      }
    }

    if (operationsInBatch > 0) {
      await currentBatch.commit();
    }

    console.log(
      `✅ Backed up ${copiedCount} ${TENANT_SCHEMA_COLLECTION} documents to ${TENANT_SCHEMA_BACKUP_COLLECTION} in ${databaseName}`
    );
    return { success: true, copied: copiedCount, errors: [] };
  } catch (error) {
    console.error(
      `❌ Error backing up ${TENANT_SCHEMA_COLLECTION} to ${TENANT_SCHEMA_BACKUP_COLLECTION} in ${databaseName}:`,
      error.message
    );
    return { success: false, copied: 0, errors: [error.message] };
  }
};

module.exports = {
  TENANT_SCHEMA_COLLECTION,
  TENANT_SCHEMA_BACKUP_COLLECTION,
  createBackupDocId,
  backupTenantSchemaDocument,
  backupTenantSchemaCollection,
};
