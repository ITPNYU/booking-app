# Multi-Tenant + XState Feature Production Environment Release Guide

## Overview

The current Production environment does not have XState or multi-tenant functionality. To release these features, you need to create new collections for the Media Commons (mc) tenant and configure the tenant schema.

## Required mc-Prefix Collections

The following collections need to be created in the Production database:

### 1. **mc-bookings**

- Media Commons version of the existing `bookings` collection
- Stores booking information including XState snapshot data

### 2. **mc-bookingLogs**

- Records booking history and change logs
- Tracks approval flows, status changes, etc.

### 3. **mc-bookingTypes**

- Booking types (Class Session, General Event, Meeting, Workshop, etc.)
- List of types users can select when making a booking

### 4. **mc-usersApprovers**

- List of approvers
- Approver information for Liaisons
- Contains department, email

### 5. **mc-usersRights**

- User permission management
- Permission flags like isAdmin, isLiaison, isWorker

### 6. **mc-usersWhitelist**

- List of users for whom training prerequisites do not apply
- Required to book certain rooms

### 7. **mc-operationHours**

- Facility operation hours settings
- Opening and closing times for each day of the week

### 8. **mc-blackoutPeriods**

- Settings for unbookable periods
- Maintenance periods, holiday periods, etc.

### 9. **mc-preBanLogs**

- User penalty logs
- Records of No-shows, Late cancels, etc.

### 10. **mc-counters**

- Sequential ID counters for booking numbers, etc.
- Has a `count` field in the `bookings` document

## Tenant-Shared Collections (No mc-prefix)

### 11. **tenantSchema**

- Collection storing tenant configurations
- Document ID: `mc`, `itp`, etc.
- Includes:
  - tenant name, logo, policy
  - resources (room/equipment information)
  - roles, roleMapping
  - programMapping
  - agreements
  - emailMessages
  - various display setting flags

## Release Procedure

### Phase 1: Create Tenant Schema

#### 1.1 Copy Tenant Schema to Production

```bash
node scripts/copyCollection.js \
  --source-database development \
  --target-database production \
  --source-collection tenantSchema \
  --target-collection tenantSchema
```

### Phase 2: Create mc-Collections and Migrate Data

#### 3.1 Execute All Collection Copy Commands

Run the following commands in sequence. Each command copies data from existing collections to the new mc-prefixed collections.

**Step 1: Copy existing table to mc-**

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
  --source-database production \
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

**Step 2: Manually add usersPA data to mc-usersRights**

After copying the base permission data, you need to manually add PA (Program Assistant) users from the `usersPA` collection to `mc-usersRights`:

1. Go to Firebase Console → Firestore Database
2. Open the `usersPA` collection in Production
3. For each PA user document:
   - Note the user's email address
   - Go to `mc-usersRights` collection
   - Create or update a document with the user's email as the document ID
   - Set the appropriate permission flags (e.g., `isPA: true`, `isLiaison: true`, etc.)

Example document structure in `mc-usersRights`:

```json
{
  "email": "pa-user@nyu.edu",
  "isPA": true,
  "isLiaison": true,
  "isAdmin": false,
  "isWorker": false
}
```

```bash
# Copy safety training user data
node scripts/copyCollection.js \
  --source-database production \
  --target-database production \
  --source-collection usersWhitelist \
  --target-collection mc-usersWhitelist
```

```bash
# Copy operation hours settings
node scripts/copyCollection.js \
  --source-database production \
  --target-database production \
  --source-collection operationHours \
  --target-collection mc-operationHours
```

```bash
# Copy blackout period settings
node scripts/copyCollection.js \
  --source-database production \
  --target-database production \
  --source-collection blackoutPeriods \
  --target-collection mc-blackoutPeriods
```

```bash
# Copy preBanLogs data
node scripts/copyCollection.js \
  --source-database production \
  --target-database production \
  --source-collection preBanLogs \
  --target-collection mc-preBanLogs
```

#### 3.2 Initialize mc-counters Collection

**IMPORTANT**: This must be done before creating any new bookings to avoid duplicate request numbers.

**Step 1: Find the highest requestNumber in existing bookings**

1. Go to Firebase Console → Firestore Database
2. Open the `counters` collection
3. Note the value (e.g., 1250)

**Step 2: Create mc-counters collection with initial value**

In Firebase Console:

1. Go to Firestore Database
2. Click `mc-counters`
3. Update value

#### 3.3 Verification After All Copies

Run this verification checklist in Firebase Console:

- [ ] `tenantSchema` collection exists with document ID `mc`
- [ ] `mc-bookings` collection exists and has data
- [ ] `mc-bookingTypes` collection exists and has data
- [ ] `mc-usersApprovers` collection exists and has data
- [ ] `mc-usersRights` collection exists and has data
- [ ] `mc-usersWhitelist` collection exists and has data
- [ ] `mc-operationHours` collection exists and has data
- [ ] `mc-blackoutPeriods` collection exists and has data
- [ ] `mc-counters` collection exists with correct `bookings` document
- [ ] `mc-counters/bookings` has `count` field set to max requestNumber + 1

### Phase 5: Application Deployment

#### 5.1 Deployment

1. Create a pull request from main to prod.
2. Merge the pull request.
3. Verify that the “Deploy PRODUCTION to App Engine” workflow has completed successfully.

#### 5.2 Post-Deployment Verification

1. Access https://flowing-mantis-389917.uc.r.appspot.com/
2. Verify tenant schema is loaded correctly
3. Verify booking creation flow works properly
4. Verify XState transitions are recorded correctly

### Phase 6: Testing and Verification

#### 6.1 Basic Functionality Tests

- [ ] Create new bookings (User, Walk-in, VIP)
- [ ] Approval flow (Liaison → Admin)
- [ ] Approval flow (Liaison → Admin → Service(s) request(s))
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

Revert the pull request previously merged into prod.

1. Open the merged PR on GitHub → click “Revert” → create a revert PR into prod.
2. Merge the revert PR into prod.

## Important Notes

1. **Existing Booking Data**: Recommended to keep the existing `bookings` collection. Coexistence with `mc-bookings` is possible.

2. **XState Auto-Restore**: Existing bookings without XState data will automatically have XState generated from their current status when accessed.

3. **Counter Initialization is Critical**:
   - The `mc-counters` collection MUST be initialized before any new bookings are created
   - If not initialized, the counter will start at 1, causing duplicate requestNumber issues
   - Always set the initial count to be higher than the maximum existing requestNumber
   - The counter is automatically incremented by `serverGetNextSequentialId()` function when creating new bookings

## Checklist

### Before Release:

- [ ] Backup completed
- [x] Tenant schema created in development
- [x] All mc-collections created
- [ ] mc-counters initialized with correct value
- [ ] Approvers and permission users configured

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

- blackoutPeriods
- bookingLogs
- bookingTypes
- bookings
- counters
- operationHours
- preBanLogs
- usersApprovers
- usersRights
- usersWhitelist

### XState Integration

The system uses XState v5 for state management:

- **mcBookingMachine**: Handles Media Commons booking workflows with service requests
- **itpBookingMachine**: Handles ITP booking workflows with service requests
- **Automatic Restoration**: Bookings without XState data are automatically migrated on access

### Service Request Workflow

Media Commons supports additional service requests (equipment, staffing, catering, cleaning, security, setup) with approval workflows managed through XState.

## Support and Troubleshooting

If you encounter issues during migration:

1. Check Firebase Console for collection existence and data
2. Review application logs
3. Verify environment variables are set correctly
4. Check `mc-counters` initialization
5. Confirm tenant schema is correctly formatted
