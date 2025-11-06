# Multi-Tenant + XState Feature Production Environment Release Guide

## Overview

The current Production environment does not have XState or multi-tenant functionality. To release these features, you need to create new collections for the Media Commons (mc) tenant and configure the tenant schema.

## Required mc-Prefix Collections

The following collections need to be created in the Production database:

### 1. **mc-bookings** (Required)

- Media Commons version of the existing `bookings` collection
- Stores booking information including XState snapshot data

### 2. **mc-bookingLogs** (Required)

- Records booking history and change logs
- Tracks approval flows, status changes, etc.

### 3. **mc-bookingTypes** (Required)

- Booking types (Class Session, General Event, Meeting, Workshop, etc.)
- List of types users can select when making a booking

### 4. **mc-usersApprovers** (Required)

- List of approvers
- Approver information for level 1 (Liaison), level 2 (Admin), level 3 (Services)
- Contains department, email, level fields

### 5. **mc-usersRights** (Required)

- User permission management
- Permission flags like isAdmin, isLiaison, isWorker

### 6. **mc-usersWhitelist** (Required)

- List of users who have completed Safety Training
- Required to book certain rooms

### 7. **mc-operationHours** (Recommended)

- Facility operation hours settings
- Opening and closing times for each day of the week

### 8. **mc-blackoutPeriods** (Recommended)

- Settings for unbookable periods
- Maintenance periods, holiday periods, etc.

### 9. **mc-preBanLogs** (Recommended)

- User penalty logs
- Records of No-shows, Late cancels, etc.

### 10. **mc-counters** (Required)

- Sequential ID counters for booking numbers, etc.
- Has a `count` field in the `bookings` document

## Tenant-Shared Collections (No mc-prefix)

### 11. **tenantSchema** (Required)

- Collection storing tenant configurations
- Document ID: `mc` or `mediaCommons`
- Includes:
  - tenant name, logo, policy
  - resources (room/equipment information)
  - roles, roleMapping
  - programMapping
  - agreements
  - emailMessages
  - various display setting flags

## Release Procedure

### Phase 1: Preparation

#### 1.1 Verify Environment Variables on Production deployment workflow

```bash
# Confirm the following are set in deploy_production_app_engine.yml
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

### Phase 2: Create Tenant Schema

#### 2.1 Copy Tenant Schema to Production

```bash
node scripts/copyCollection.js \
  --source-database development \
  --target-database production \
  --source-collection tenantSchema \
  --target-collection tenantSchema
```

### Phase 3: Create mc-Collections and Migrate Data

#### 3.1 Execute All Collection Copy Commands

Run the following commands in sequence. Each command copies data from existing collections to the new mc-prefixed collections.

**Step 1: Copy existing tabel to mc-**

```bash
# Migrate existing booking data to mc-bookings
node scripts/copyCollection.js \
  --source-database production \
  --target-database production \
  --source-collection bookings \
  --target-collection mc-bookings
```

```bash
node scripts/copyCollection.js \
  --source-database development \
  --target-database production \
  --source-collection bookingTypes \
  --target-collection mc-bookingTypes
```

```bash
# Copy approver data
node scripts/copyCollection.js \
  --source-database development \
  --target-database production \
  --source-collection usersApprovers \
  --target-collection mc-usersApprovers
```

```bash
# Copy user permission data
node scripts/copyCollection.js \
  --source-database development \
  --target-database production \
  --source-collection usersRights \
  --target-collection mc-usersRights
```

```bash
# Copy safety training user data
node scripts/copyCollection.js \
  --source-database development \
  --target-database production \
  --source-collection usersWhitelist \
  --target-collection mc-usersWhitelist
```

```bash
# Copy operation hours settings
node scripts/copyCollection.js \
  --source-database development \
  --target-database production \
  --source-collection operationHours \
  --target-collection mc-operationHours
```

```bash
# Copy blackout period settings
node scripts/copyCollection.js \
  --source-database development \
  --target-database production \
  --source-collection blackoutPeriods \
  --target-collection mc-blackoutPeriods
```

#### 3.2 Initialize mc-counters Collection

**IMPORTANT**: This must be done before creating any new bookings to avoid duplicate request numbers.

**Step 1: Find the highest requestNumber in existing bookings**

Option A - Using Firebase Console:

1. Go to Firebase Console → Firestore Database
2. Open the `bookings` or `mc-bookings` collection
3. Sort by `requestNumber` field (descending)
4. Note the highest `requestNumber` value (e.g., 12500)

**Step 2: Create mc-counters collection with initial value**

In Firebase Console:

1. Go to Firestore Database
2. Click "Start collection"
3. Collection ID: `mc-counters`
4. Document ID: `bookings`
5. Add field:
   - Field name: `count`
   - Field type: `number`
   - Value: `[MAX_REQUEST_NUMBER + 1]` (e.g., if max is 12500, set to 12501)

Example document structure:

```javascript
// Collection: mc-counters
// Document ID: bookings
{
  count: 12501; // Set this to (max requestNumber + 1)
}
```

**Step 3: Verify counter initialization**

```bash
# In Firebase Console, check that:
# - Collection mc-counters exists
# - Document 'bookings' exists with correct count value
# - count value is higher than any existing requestNumber
```

#### 3.3 Create Empty Collections for Logs

The following collections will be automatically populated but can be initialized as empty:

**mc-bookingLogs** (will be created automatically from new bookings):

```bash
# No action needed - this collection will be created automatically
# when the first booking creates a log entry
```

**mc-preBanLogs** (for future penalty records):

```bash
# No action needed - this collection will be created automatically
# when the first penalty is recorded
```

#### 3.4 Verification After All Copies

Run this verification checklist in Firebase Console:

- [ ] `tenantSchema` collection exists with document ID `mc`
- [ ] `mc-bookings` collection exists and has data
- [ ] `mc-bookingTypes` collection exists and has data
- [ ] `mc-usersApprovers` collection exists and has data
- [ ] `mc-usersRights` collection exists and has data
- [ ] `mc-usersWhitelist` collection exists and has data
- [ ] `mc-operationHours` collection exists (if applicable)
- [ ] `mc-blackoutPeriods` collection exists (if applicable)
- [ ] `mc-counters` collection exists with correct `bookings` document
- [ ] `mc-counters/bookings` has `count` field set to max requestNumber + 1

### Phase 4: Migrate Existing Booking Data to XState (Optional)

If existing booking data in mc-bookings doesn't have XState data, the application will automatically restore XState from the current status. However, if you want to migrate in advance:

1. **Create Migration Script** (if needed)
2. **Gradual Migration**: New bookings will automatically have XState attached

The system includes automatic XState restoration in `lib/stateMachines/xstateUtilsV5.ts`:

- When a booking without XState data is accessed, it automatically creates XState from the current status
- This ensures backward compatibility with existing bookings

### Phase 5: Application Deployment

#### 5.1 Set Environment Variables (Vercel/Production Environment)

```bash
# Set the following environment variables in Production environment
DEFAULT_TENANT=mc
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

#### 5.2 Deploy Code

```bash
# Merge branch to main
git checkout main
git merge update-services-closedout-logic
git push origin main

# Vercel will automatically deploy
# Or manual deployment
vercel --prod
```

#### 5.3 Post-Deployment Verification

1. Access https://your-app.vercel.app/mc
2. Verify tenant schema is loaded correctly
3. Verify booking creation flow works properly
4. Verify XState transitions are recorded correctly

### Phase 6: Testing and Verification

#### 6.1 Basic Functionality Tests

- [ ] Create new bookings (Walk-in, VIP, Regular)
- [ ] Approval flow (Liaison → Admin)
- [ ] Service request approval
- [ ] Booking cancellation
- [ ] Check-in / Check-out

#### 6.2 Data Verification

```bash
# Verify the following in Firestore Console
# - xstateData field exists in mc-bookings
# - History is recorded in mc-bookingLogs
# - count in mc-counters is incrementing
```

#### 6.3 XState Operation Verification

- XState functionality is working correctly
- State transitions are recorded correctly
- Existing bookings (without XState data) display and operate normally

### Phase 7: Rollback Procedure (If Issues Occur)

```bash
# 1. Revert to previous version
git revert HEAD
git push origin main

# 2. Rollback to previous deployment in Vercel
# Or
vercel rollback

# 3. Restore data from backup if necessary
node scripts/copyCollection.js \
  --source-database production \
  --target-database production \
  --source-collection bookings_backup_YYYYMMDD \
  --target-collection bookings
```

## Quick Copy Command Reference

For easy copy-paste, here are all the copy commands in sequence:

```bash
# 1. Tenant Schema
node scripts/copyCollection.js --source-database development --target-database production --source-collection tenantSchema --target-collection tenantSchema

# 2. Bookings
node scripts/copyCollection.js --source-database production --target-database production --source-collection bookings --target-collection mc-bookings

# 3. Booking Types
node scripts/copyCollection.js --source-database development --target-database production --source-collection bookingTypes --target-collection mc-bookingTypes

# 4. User Approvers
node scripts/copyCollection.js --source-database development --target-database production --source-collection usersApprovers --target-collection mc-usersApprovers

# 5. User Rights
node scripts/copyCollection.js --source-database development --target-database production --source-collection usersRights --target-collection mc-usersRights

# 6. Safety Whitelist
node scripts/copyCollection.js --source-database development --target-database production --source-collection usersWhitelist --target-collection mc-usersWhitelist

# 7. Operation Hours (optional)
node scripts/copyCollection.js --source-database development --target-database production --source-collection operationHours --target-collection mc-operationHours

# 8. Blackout Periods (optional)
node scripts/copyCollection.js --source-database development --target-database production --source-collection blackoutPeriods --target-collection mc-blackoutPeriods
```

**Note**: After running all copy commands, manually create the `mc-counters` collection in Firebase Console as described in Phase 3.2.

## Important Notes

1. **Existing Booking Data**: Recommended to keep the existing `bookings` collection. Coexistence with `mc-bookings` is possible.

2. **XState Auto-Restore**: Existing bookings without XState data will automatically have XState generated from their current status when accessed.

3. **Counter Initialization is Critical**:
   - The `mc-counters` collection MUST be initialized before any new bookings are created
   - If not initialized, the counter will start at 1, causing duplicate requestNumber issues
   - Always set the initial count to be higher than the maximum existing requestNumber
   - The counter is automatically incremented by `serverGetNextSequentialId()` function when creating new bookings

4. **Approver Setup**: Configure at least one level 2 (Admin) approver in `mc-usersApprovers`.

5. **Auto-checkout**: Configure `/api/bookings/auto-checkout` to run periodically (Vercel Cron Jobs).

## Checklist

### Before Release:

- [ ] Backup completed
- [ ] Tenant schema created in development
- [ ] All mc-collections created
- [ ] mc-counters initialized with correct value
- [ ] Approvers and permission users configured
- [ ] Staging environment testing completed
- [ ] Environment variables set in production

### After Release:

- [ ] New booking creation test
- [ ] Approval flow test
- [ ] XState data recording verification
- [ ] Existing booking display and operation verification
- [ ] Error log review
- [ ] Counter incrementing correctly

## Related Files

- `booking-app/scripts/copyCollection.js`: Collection copy script
- `booking-app/components/src/policy.ts`: Tenant-specific collection definitions (lines 37-49)
- `booking-app/lib/stateMachines/mcBookingMachine.ts`: Media Commons XState machine
- `booking-app/lib/stateMachines/xstateUtilsV5.ts`: XState utilities with auto-restore functionality
- `booking-app/components/src/client/routes/components/SchemaProvider.tsx`: Tenant schema type definitions

## Technical Architecture Notes

### Multi-Tenant Collection Strategy

Collections are prefixed with tenant identifiers (e.g., `mc-bookings`) as defined in `getTenantCollectionName()` function in `components/src/policy.ts`. The following collections are tenant-specific:

- bookings
- bookingLogs
- bookingTypes
- blackoutPeriods
- counters
- operationHours
- preBanLogs
- usersWhitelist
- usersApprovers
- usersRights

### XState Integration

The system uses XState v5 for state management:

- **mcBookingMachine**: Handles Media Commons booking workflows with service requests
- **itpBookingMachine**: Handles ITP booking workflows
- **Automatic Restoration**: Bookings without XState data are automatically migrated on access

### Service Request Workflow

Media Commons supports additional service requests (equipment, staffing, catering, cleaning, security, setup) with approval workflows managed through XState.

## Support and Troubleshooting

If you encounter issues during migration:

1. Check Firebase Console for collection existence and data
2. Review application logs in Vercel
3. Verify environment variables are set correctly
4. Check `mc-counters` initialization
5. Confirm tenant schema is correctly formatted

For questions or issues, refer to the related files listed above or contact the development team.
