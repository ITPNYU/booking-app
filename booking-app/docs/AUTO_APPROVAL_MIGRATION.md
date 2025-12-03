# Auto-Approval Configuration Migration Guide

## Overview

This guide explains the migration from the legacy `shouldAutoApprove` boolean field to the new `autoApproval` configuration object in tenant schemas. This change provides more granular control over auto-approval behavior and addresses the loopholes identified with the previous system.

## Why This Change?

The previous auto-approval system had several issues:

1. **Too Permissive**: A simple boolean (`shouldAutoApprove: true`) allowed any booking to be auto-approved without consideration for services, duration, or user role
2. **Circumventing Policy**: Users could request auto-approval and then ask for equipment/services via email, effectively "cutting the line"
3. **No Granularity**: Couldn't specify different rules for different user roles or service types
4. **Student Clubs Workaround**: Clubs could bypass policies using auto-approval

## New Configuration Structure

### Old Structure (Deprecated)

```typescript
{
  roomId: 224,
  name: "Room 224",
  shouldAutoApprove: true,  // ❌ Deprecated - too permissive
  maxHour: { student: 4, faculty: 8, admin: -1 },
  minHour: { student: 1, faculty: 1, admin: 1 }
}
```

### New Structure

```typescript
{
  roomId: 224,
  name: "Room 224",
  autoApproval: {
    minHour: {
      admin: -1,    // -1 = no limit
      faculty: -1,
      student: -1
    },
    maxHour: {
      admin: -1,
      faculty: -1,
      student: -1
    },
    conditions: {
      setup: false,        // Allow auto-approval with setup requests
      equipment: false,    // Allow auto-approval with equipment requests
      staffing: false,     // Allow auto-approval with staffing requests
      catering: false,     // Allow auto-approval with catering requests
      cleaning: false,     // Allow auto-approval with cleaning requests
      security: false      // Allow auto-approval with security requests
    }
  }
}
```

## Migration Steps

### Step 1: Update Tenant Schemas BEFORE Deployment

**⚠️ CRITICAL**: You MUST update all tenant schemas before deploying this version, as backward compatibility has been removed.

#### To Disable Auto-Approvals (Recommended)

Based on your feedback, we recommend **disabling auto-approvals entirely** for standard reservations:

```typescript
{
  roomId: 224,
  name: "Room 224",
  // Remove autoApproval field entirely, or set to null
  autoApproval: null
}
```

Or simply omit the `autoApproval` field from the room configuration.

#### To Enable Auto-Approvals with Specific Rules

If you need auto-approval for specific scenarios, add the `autoApproval` configuration as shown in the examples below.

### Step 2: Verify All Tenant Schema Documents

For each tenant in the `tenantSchema` collection:

#### Before (Firebase Console)
```javascript
{
  tenant: "mc",
  resources: [
    {
      roomId: 224,
      name: "Room 224",
      shouldAutoApprove: true,  // Old field
      // ... other fields
    }
  ]
}
```

#### After (Firebase Console)
```javascript
{
  tenant: "mc",
  resources: [
    {
      roomId: 224,
      name: "Room 224",
      // autoApproval field omitted = auto-approval disabled
      // ... other fields
    }
  ]
}
```

### Step 3: Verify Changes

After updating the tenant schema:

1. Test booking creation for each room
2. Verify all bookings go to "REQUESTED" status
3. Confirm services can still be requested but require approval
4. Check that VIP and Walk-In bookings still work (these bypass auto-approval checks)

## Configuration Examples

### Example 1: Completely Disable Auto-Approval (Recommended)

```typescript
{
  roomId: 224,
  name: "Room 224",
  // No autoApproval field = disabled
}
```

### Example 2: Enable for Short Bookings Only (If Needed)

If you want to allow auto-approval for very short bookings (e.g., under 2 hours):

```typescript
{
  roomId: 224,
  name: "Room 224",
  autoApproval: {
    maxHour: {
      admin: 2,
      faculty: 2,
      student: 2
    },
    minHour: {
      admin: -1,
      faculty: -1,
      student: -1
    },
    conditions: {
      setup: false,      // Require approval if setup requested
      equipment: false,  // Require approval if equipment requested
      staffing: false,   // Require approval if staffing requested
      catering: false,   // Require approval if catering requested
      cleaning: false,   // Require approval if cleaning requested
      security: false    // Require approval if security requested
    }
  }
}
```

### Example 3: Role-Based Auto-Approval (Advanced)

If you want different rules for different roles:

```typescript
{
  roomId: 224,
  name: "Room 224",
  autoApproval: {
    maxHour: {
      admin: -1,    // Admins: no limit
      faculty: 4,   // Faculty: up to 4 hours
      student: 2    // Students: up to 2 hours
    },
    minHour: {
      admin: -1,
      faculty: 1,
      student: 1
    },
    conditions: {
      setup: false,
      equipment: false,
      staffing: false,
      catering: false,
      cleaning: false,
      security: false
    }
  }
}
```

### Example 4: Allow Simple Equipment Checkouts (Specific Use Case)

For equipment rooms where simple checkouts should be auto-approved:

```typescript
{
  roomId: 999,
  name: "Equipment Checkout",
  isEquipment: true,
  autoApproval: {
    maxHour: {
      admin: -1,
      faculty: 24,  // Up to 24 hours
      student: 4    // Up to 4 hours
    },
    minHour: {
      admin: -1,
      faculty: -1,
      student: -1
    },
    conditions: {
      setup: false,
      equipment: true,   // ✅ Allow auto-approval for equipment checkouts
      staffing: false,
      catering: false,
      cleaning: false,
      security: false
    }
  }
}
```

## Special Booking Types (Always Auto-Approved)

The following booking types **always bypass auto-approval checks**, regardless of configuration:

1. **VIP Bookings**: `isVip: true`
2. **Walk-In Bookings**: `isWalkIn: true`

These are intentionally exempt from auto-approval restrictions.

## Breaking Change Notice

**⚠️ IMPORTANT**: The legacy `shouldAutoApprove` field has been completely removed. All tenant schemas must be updated before deploying this version.

- The old `shouldAutoApprove: boolean` field is **no longer supported**
- Only the new `autoApproval` configuration object is recognized
- Tenant schemas must be migrated before deployment to avoid breaking auto-approval functionality

## Testing the Migration

### Test Case 1: Standard Booking (Should Require Approval)

1. Create a booking for Room 224
2. Select any duration
3. Do NOT request services
4. **Expected**: Booking status should be "REQUESTED"

### Test Case 2: Booking with Services (Should Require Approval)

1. Create a booking for Room 224
2. Request equipment or setup
3. **Expected**: Booking status should be "REQUESTED"

### Test Case 3: VIP Booking (Should Auto-Approve)

1. Create a VIP booking
2. **Expected**: Booking status should be "APPROVED" immediately

### Test Case 4: Walk-In Booking (Should Auto-Approve)

1. Create a walk-in booking
2. **Expected**: Booking status should be "APPROVED" immediately

## Migration Script (REQUIRED)

**⚠️ Run this script BEFORE deploying the new code to remove all `shouldAutoApprove` fields:**

```javascript
// Run this in Firebase Console or as a Cloud Function
const admin = require('firebase-admin');
const db = admin.firestore();

async function migrateAutoApproval(tenant) {
  const schemaRef = db.collection('tenantSchema').doc(tenant);
  const schema = await schemaRef.get();
  
  if (!schema.exists) {
    console.log(`Schema not found for tenant: ${tenant}`);
    return;
  }
  
  const data = schema.data();
  const resources = data.resources || [];
  
  // Remove shouldAutoApprove from all resources
  const migratedResources = resources.map(resource => {
    const { shouldAutoApprove, ...rest } = resource;
    
    if (shouldAutoApprove) {
      console.log(`Removed shouldAutoApprove=true from room ${resource.roomId}`);
    }
    
    return rest;
  });
  
  await schemaRef.update({
    resources: migratedResources
  });
  
  console.log(`✅ Migrated ${resources.length} resources for tenant: ${tenant}`);
}

// IMPORTANT: Run for ALL tenants before deployment
async function migrateAllTenants() {
  await migrateAutoApproval('mc');
  await migrateAutoApproval('itp');
  // Add other tenants as needed
  console.log('✅ All tenants migrated successfully');
}

migrateAllTenants();
```

## Troubleshooting

### Issue: Bookings Still Auto-Approving

**Cause**: Room still has `shouldAutoApprove: true` or `autoApproval` configured

**Solution**: Remove both fields from the room configuration in tenant schema

### Issue: VIP/Walk-In Not Auto-Approving

**Cause**: Bug in the system (these should always auto-approve)

**Solution**: Check that `isVip` or `isWalkIn` flags are properly set in the booking context

### Issue: Different Behavior in Tests vs Production

**Cause**: Test fixtures may have different room configurations

**Solution**: Update test fixtures to match production tenant schemas

## Support

For questions about this migration:

1. Review the implementation in `lib/utils/autoApprovalUtils.ts`
2. Check the state machine logic in `lib/stateMachines/mcBookingMachine.ts`
3. Test in development environment before applying to production
4. Contact the development team if issues persist

## Deployment Timeline

**⚠️ BREAKING CHANGE - Follow this order strictly:**

1. **BEFORE Deployment**: Run migration script to remove all `shouldAutoApprove` fields from tenant schemas
2. **Verify**: Confirm all tenant schemas are updated (no `shouldAutoApprove` fields remain)
3. **Deploy**: Deploy the new code to production
4. **Test**: Verify all bookings require approval (except VIP/Walk-In)
5. **Monitor**: Watch for any unexpected behavior over the next week

