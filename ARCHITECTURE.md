# Booking App Architecture Documentation

**Purpose:** Communication, Onboarding, and Developer Reference

This document provides a comprehensive overview of the booking application's architecture, database structure, user roles, and booking workflows.

---

## Table of Contents

1. [Database Collections](#database-collections)
2. [User Roles & Permissions](#user-roles--permissions)
3. [Booking States & Workflow](#booking-states--workflow)
4. [APIs & Components](#apis--components)
5. [Tenant Architecture](#tenant-architecture)
6. [Developer Terminology](#developer-terminology)

---

## Database Collections

### Core Collections

#### `bookings`
- **Purpose:** Stores all booking/reservation records
- **Tenant-Specific:** Yes (format: `{tenant}-bookings`)
- **Key Fields:**
  - `calendarEventId`: Google Calendar event ID
  - `email`: User who made the booking
  - `startDate`, `endDate`: Booking time window (Timestamp)
  - `roomId`: Room identifier
  - `requestNumber`: Unique booking request number
  - `equipmentCheckedOut`: Equipment checkout status
  - All status timestamps (requestedAt, firstApprovedAt, finalApprovedAt, etc.)
  - `xstateData`: XState machine state for tenants using state machines
  - `origin`: How the booking was created (user, admin, walk-in, etc.)

#### `bookingLogs`
- **Purpose:** Tracks all changes to booking status over time
- **Tenant-Specific:** Yes (format: `{tenant}-bookingLogs`)
- **Key Fields:**
  - `bookingId`: Reference to the booking document
  - `calendarEventId`: Google Calendar event ID
  - `status`: New status (BookingStatusLabel enum)
  - `changedBy`: Email of user who made the change
  - `changedAt`: Timestamp of the change
  - `requestNumber`: Booking request number
  - `note`: Optional note about the change
- **Usage:** Audit trail for booking status transitions, used for debugging and compliance

#### `bookingTypes`
- **Purpose:** Defines available booking types/categories
- **Tenant-Specific:** No
- **Key Fields:**
  - `bookingType`: Type name (e.g., "Meeting", "Event", "Class")
  - `createdAt`: Creation timestamp

#### `departments`
- **Purpose:** NYU departments for user affiliation
- **Tenant-Specific:** No
- **Key Fields:**
  - Department name and code
- **Usage:** Used in booking forms and for liaison assignment

#### `resources`
- **Purpose:** Defines available rooms and resources
- **Tenant-Specific:** No
- **Key Fields:**
  - `roomId`: Unique room identifier
  - `name`: Room name
  - `capacity`: Room capacity
  - `calendarId`: Google Calendar ID for the room
  - `needsSafetyTraining`: Whether room requires safety training
  - `shouldAutoApprove`: Whether bookings auto-approve
  - `isWalkIn`: Whether room supports walk-in bookings
  - `isEquipment`: Whether room is equipment-only
  - `services`: Available services for this room
  - `staffingServices`: Available staffing options
  - `staffingSections`: Staff assignment configuration

#### `blackoutPeriods`
- **Purpose:** Defines time periods when booking is not allowed
- **Tenant-Specific:** Yes (format: `{tenant}-blackoutPeriods`)
- **Key Fields:**
  - `name`: Period name
  - `startDate`, `endDate`: Date range (Timestamp)
  - `startTime`, `endTime`: Optional time restrictions (HH:mm format)
  - `isActive`: Whether the blackout is currently active
  - `roomIds`: Optional array of room IDs (empty = applies to all rooms)

#### `operationHours`
- **Purpose:** Defines operating hours for each day of the week
- **Tenant-Specific:** Yes (format: `{tenant}-operationHours`)
- **Key Fields:**
  - `day`: Day of week enum (Sunday-Saturday)
  - `open`, `close`: Operating hours (number)
  - `isClosed`: Whether closed on this day
  - `roomId`: Optional room-specific hours

### User Collections (Legacy - Being Migrated)

**Note:** These collections are being consolidated into `usersRights`. The legacy collections will eventually be removed.

#### `usersAdmin` (LEGACY)
- **Purpose:** Users with Admin access to the Admin user context
- **Status:** Will be replaced by `isAdmin` boolean in `usersRights`
- **Key Fields:**
  - `email`: User email
  - `createdAt`: When admin access was granted

#### `usersPa` (LEGACY)
- **Purpose:** Production Assistants (Media Commons-specific term) / Workers (generic term)
- **Status:** Will be replaced by `isWorker` boolean in `usersRights`
- **Key Fields:**
  - `email`: User email
  - `createdAt`: When PA access was granted
- **Note:** "PA" is Media Commons-specific language; "Worker" is the generic app language

#### `usersApprovers`
- **Purpose:** Maps departments to their designated liaisons/approvers
- **Tenant-Specific:** Yes (format: `{tenant}-usersApprovers`)
- **Key Fields:**
  - `email`: Approver/Liaison email
  - `department`: Department they're responsible for
  - `level`: Approver level (1 = first, 2 = final, 3 = equipment)
  - `createdAt`: When assignment was created
- **Note:** "Liaison" is Media Commons-specific language; "Approver" is the generic app language

#### `usersEquipment`
- **Purpose:** Users responsible for equipment/service requests
- **Status:** Will be either:
  1. Renamed to `usersServices` and store service responsibility, OR
  2. Folded into `usersApprovers`

#### `usersSuperAdmin`
- **Purpose:** Super Users with Admin rights across ALL tenants
- **Tenant-Specific:** No (intentionally global)
- **Key Fields:**
  - `email`: Super admin email
  - `createdAt`: When super admin access was granted
- **Usage:** Super admins have admin rights across all tenants plus access to tenant-management settings
- **Note:** NOT migrated to `usersRights` - remains separate for security and cross-tenant access

#### `usersWhitelist` / `usersRights`
- **Purpose:** Safety training completion tracking / User permissions
- **Tenant-Specific:** Yes (format: `{tenant}-usersWhitelist`, `{tenant}-usersRights`)
- **Key Fields:**
  - `email`: User email
  - `completedAt`: Training completion timestamp (for safety training)

### New Consolidated Collection

#### `usersRights` (Current Standard)
- **Purpose:** Consolidated user permissions and rights management
- **Tenant-Specific:** Yes (format: `{tenant}-usersRights`)
- **Key Fields:**
  - `email`: User email (primary identifier)
  - `isAdmin`: Has Admin user context access
  - `isWorker`: Has Worker/PA user context access
  - `isLiaison`: Has Liaison user context access (approver)
  - `isEquipment`: Has Equipment service approval rights
  - `isStaffing`: Has Staffing service approval rights
  - `isSetup`: Has Setup service approval rights
  - `isCatering`: Has Catering service approval rights
  - `isCleaning`: Has Cleaning service approval rights
  - `isSecurity`: Has Security service approval rights
- **Migration:** Script `scripts/mergeUsersCollections.js` merges legacy collections into this format
- **Benefits:** 
  - Single source of truth for user permissions
  - No duplicate records across collections
  - Easier to query user capabilities
  - Scalable - just add boolean flags for new permissions

### Settings & Configuration

#### `settings`
- **Purpose:** Application-wide settings
- **Tenant-Specific:** No
- **Key Fields:**
  - `bookingTypes`: Array of available booking types

#### `policySettings`
- **Purpose:** Policy-specific configuration
- **Tenant-Specific:** No
- **Key Fields:**
  - `finalApproverEmail`: Email for final approvals

#### `tenantSchema`
- **Purpose:** Defines tenant-specific configuration and schemas
- **Tenant-Specific:** No (stores info ABOUT tenants)
- **Usage:** Multi-tenancy configuration

### Audit & Safety

#### `usersBanned`
- **Purpose:** List of banned users
- **Tenant-Specific:** No
- **Key Fields:**
  - `email`: Banned user email
  - `bannedAt`: Ban timestamp

#### `preBanLogs`
- **Purpose:** Tracks warnings before banning (late cancels, no-shows)
- **Tenant-Specific:** Yes (format: `{tenant}-preBanLogs`)
- **Key Fields:**
  - `bookingId`: Related booking
  - `netId`: User's NetID
  - `lateCancelDate`: Late cancellation timestamp
  - `noShowDate`: No-show timestamp

---

## User Roles & Permissions

### Role Hierarchy

The application uses a multi-level permission system with the following roles:

#### 1. User (Base Level)
- **Who:** Anyone with NYU credentials
- **What:** Can create bookings, view their own bookings
- **When:** Default role for all authenticated users
- **Page Context Level:** 0

#### 2. Worker / PA (Production Assistant)
- **Who:** Media Commons Production Assistants or service workers
- **What:** 
  - Can perform service-related tasks
  - Can check in/out equipment
  - Can view bookings assigned to them
- **When:** Assigned by admins for operational staff
- **Page Context Level:** 1
- **Permission Flag:** `isWorker` in `usersRights`
- **Terminology:** "PA" is Media Commons-specific; "Worker" is generic app language

#### 3. Liaison / Approver
- **Who:** Department liaisons responsible for approving bookings from their department
- **What:**
  - Can approve/decline bookings from assigned departments
  - First-level or final-level approval depending on configuration
  - Can view pending bookings for their departments
- **When:** Assigned per department
- **Page Context Level:** 2
- **Permission Flag:** `isLiaison` in `usersRights`
- **Database:** `usersApprovers` maps departments to liaisons
- **Terminology:** "Liaison" is Media Commons-specific; "Approver" is generic app language

#### 4. Equipment / Services Approver
- **Who:** Staff responsible for specific service approvals
- **What:**
  - Can approve/decline specific services (equipment, setup, catering, etc.)
  - Service-specific permissions: `isEquipment`, `isSetup`, `isCatering`, `isCleaning`, `isSecurity`
- **When:** Assigned for specialized service management
- **Page Context Level:** 3
- **Permission Flags:** Multiple service-specific booleans in `usersRights`

#### 5. Admin
- **Who:** Administrators for a specific tenant
- **What:**
  - Full access to all bookings for their tenant
  - Can approve/decline any booking
  - Can manage users and settings for their tenant
  - Can create walk-in bookings and VIP bookings
  - Can check in/out bookings
- **When:** Assigned by super admins for tenant management
- **Page Context Level:** 4
- **Permission Flag:** `isAdmin` in `usersRights`

#### 6. Super Admin
- **Who:** System administrators
- **What:**
  - Admin rights across ALL tenants
  - Can manage tenant settings
  - Can assign admins to tenants
  - Full system access
- **When:** Assigned for system-level administration
- **Page Context Level:** 5 (implied, highest level)
- **Database:** Separate `usersSuperAdmin` collection (not in `usersRights`)
- **Note:** Kept separate for security and cross-tenant access control

### Page Permissions Enum

```typescript
enum PagePermission {
  BOOKING = "BOOKING",      // Basic user booking access
  PA = "PA",                // Worker/PA access
  LIAISON = "LIAISON",      // Liaison/Approver access
  SERVICES = "SERVICES",    // Service-specific approver access
  ADMIN = "ADMIN",          // Tenant admin access
  SUPER_ADMIN = "SUPER_ADMIN"  // System super admin access
}
```

### Approver Levels

```typescript
enum ApproverLevel {
  FIRST = 1,      // First-level approval
  FINAL = 2,      // Final approval
  EQUIPMENT = 3   // Equipment/service approval
}
```

---

## Booking States & Workflow

### Booking Status Labels

```typescript
enum BookingStatusLabel {
  REQUESTED = "REQUESTED",           // Initial state when user submits
  PRE_APPROVED = "PRE-APPROVED",     // Services pre-approved (XState tenants)
  APPROVED = "APPROVED",             // Fully approved, ready to happen
  DECLINED = "DECLINED",             // Rejected by approver
  CANCELED = "CANCELED",             // Canceled by user or admin
  CHECKED_IN = "CHECKED-IN",         // Event started, user checked in
  CHECKED_OUT = "CHECKED-OUT",       // Event ended, closed out
  CLOSED = "CLOSED",                 // Administratively closed
  NO_SHOW = "NO-SHOW",               // User didn't show up
  PENDING = "PENDING",               // Awaiting action
  EQUIPMENT = "EQUIPMENT",           // Equipment-related status
  MODIFIED = "MODIFIED",             // Booking was modified
  WALK_IN = "WALK-IN",              // Walk-in booking
  UNKNOWN = "UNKNOWN"                // Unknown/error state
}
```

### Booking Origins

```typescript
enum BookingOrigin {
  USER = "user",           // Created by end user through booking form
  ADMIN = "admin",         // Created by admin on behalf of user
  WALK_IN = "walk-in",     // Walk-in booking at venue
  VIP = "vip",            // VIP booking (special handling)
  SYSTEM = "system",       // System-generated
  PREGAME = "pre-game"     // Pre-game booking
}
```

### Standard Workflow (Non-XState Tenants)

1. **REQUESTED** → User submits booking
   - Who: End user
   - When: Booking form submission
   - What: Initial state, awaiting approval

2. **APPROVED / DECLINED** → Admin reviews
   - Who: Admin or Liaison
   - When: Admin reviews the request
   - What: If ANY approver declines → DECLINED
   - What: If all approve → APPROVED

3. **CHECKED_IN** → Event starts
   - Who: Admin or PA
   - When: Event time arrives
   - What: User arrives, booking is activated

4. **CHECKED_OUT / CLOSED** → Event ends
   - Who: Admin or PA
   - When: After event completion
   - What: Final state, booking complete
   - Note: Closed = reset/clean state

### XState Workflow (Media Commons / Advanced Tenants)

For tenants using XState machines (`mcBookingMachine`, `itpBookingMachine`):

1. **REQUESTED** → User submits booking with service requests
   - Who: End user
   - When: Booking form submission
   - What: Identifies which services are requested (staff, equipment, catering, cleaning, security, setup)

2. **PRE_APPROVED** → Per-service approval
   - Who: Service-specific approvers (liaisons for each service)
   - When: After service-by-service review
   - What: Each service has its own approval state
   - Example: Setup approved, Catering pending, Equipment declined

3. **APPROVED** → All services approved
   - Who: System (when all services approved)
   - When: All requested services have been approved
   - What: Booking is fully approved and can proceed

4. **DECLINED** → Any service declined
   - Who: Any service approver
   - When: If ANY service is declined
   - What: Entire booking is declined
   - Note: Single decline rejects the whole booking

5. **CHECKED_IN** → Event starts (same as standard)

6. **Service Closeouts** → After event
   - Who: Service-specific approvers
   - When: After event completion
   - What: Each service can be individually closed out
   - Actions: closeoutSetup, closeoutStaff, closeoutEquipment, closeoutCatering, closeoutCleaning, closeoutSecurity

7. **CHECKED_OUT** → All services closed out
   - Who: System (when all services closed)
   - When: All services have been closed out
   - What: Final complete state

### State Transitions by Role

| From State | Action | To State | Who Can Do It |
|------------|--------|----------|---------------|
| REQUESTED | approve | APPROVED | Admin, Liaison |
| REQUESTED | decline | DECLINED | Admin, Liaison |
| APPROVED | cancel | CANCELED | User, Admin |
| APPROVED | checkIn | CHECKED_IN | Admin, PA |
| CHECKED_IN | checkOut | CHECKED_OUT | Admin, PA |
| CHECKED_IN | noShow | NO_SHOW | Admin |
| PRE_APPROVED | approve | APPROVED | Admin (when all services approved) |
| PRE_APPROVED | decline | DECLINED | Admin, Service Approver |
| * | edit/modify | MODIFIED | User, Admin |

### Calendar Display Rules

Bookings are hidden from calendar view when status is:
- NO_SHOW
- CANCELED
- DECLINED
- CHECKED_OUT

### Table Display Rules

Bookings are hidden from booking tables after time elapsed when status is:
- NO_SHOW
- CHECKED_OUT
- CANCELED

---

## APIs & Components

### Key API Endpoints

#### Booking Management
- **POST /api/bookings** - Create new booking
- **GET /api/bookings** - Read booking(s)
- **PUT /api/bookings** - Update booking
- **DELETE /api/bookings** - Delete booking
- **POST /api/bookingsDirect** - Create direct booking (walk-in, VIP)

#### User Management
- **POST /api/users** - Create user
- **GET /api/users** - Read user(s)
- **PUT /api/users** - Update user
- **DELETE /api/users** - Delete user

#### Booking Logs
- **GET /api/booking-logs** - Get booking change history
  - Query param: `requestNumber` (required)
- **POST /api/booking-logs** - Log booking change
  - Body: `{ bookingId, calendarEventId, status, changedBy, requestNumber, note }`

#### Database Operations
- **POST /api/db/merge** - Merge collections (data migration)
  - Body: `{ source: TableNames, destination: TableNames }`

### Email System

#### Booking Approval Email
- **Component:** `bookingApprovalEmail`
- **Fields:**
  - `headerMessage`: Customizable header text
- **Sent When:**
  - Booking is approved
  - Status changes to final approval
- **Recipients:** 
  - Booking requester
  - CC: Operations email (configurable per environment)

### State Machines

#### Media Commons Booking Machine (`mcBookingMachine`)
- **Purpose:** Manages complex multi-service booking workflow
- **Location:** `/lib/stateMachines/mcBookingMachine.ts`
- **Features:**
  - Per-service approval tracking
  - Service-specific state transitions
  - Closeout management for each service
- **Services Tracked:**
  - Staff
  - Equipment
  - Catering
  - Cleaning
  - Security
  - Setup
- **Events:**
  - `approve`, `decline`, `edit`, `Modify`, `cancel`, `noShow`, `checkIn`, `checkOut`
  - Service-specific: `approveSetup`, `declineSetup`, `closeoutSetup`, etc.
- **Context:**
  ```typescript
  {
    tenant?: string;
    selectedRooms?: any[];
    formData?: any;
    bookingCalendarInfo?: any;
    isWalkIn?: boolean;
    calendarEventId?: string;
    email?: string;
    isVip?: boolean;
    declineReason?: string;
    servicesRequested?: { staff, equipment, catering, cleaning, security, setup };
    servicesApproved?: { staff, equipment, catering, cleaning, security, setup };
  }
  ```

#### ITP Booking Machine (`itpBookingMachine`)
- **Purpose:** Simpler booking workflow for ITP tenant
- **Location:** `/lib/stateMachines/itpBookingMachine.ts`

### Key Components

#### Provider Component
- **Location:** `/components/src/client/routes/components/Provider.tsx`
- **Purpose:** Manages user context and permissions
- **Fetches:**
  - Admin users from `usersRights` (filtered by `isAdmin`)
  - Worker/PA users from `usersRights` (filtered by `isWorker`)
  - User's current permissions

#### Booking Actions Component
- **Location:** `/components/src/client/routes/admin/components/BookingActions.tsx`
- **Purpose:** Renders action buttons based on booking status and user role
- **Actions:** Approve, Decline, Check In, Check Out, Cancel, No Show

---

## Tenant Architecture

### Multi-Tenancy Model

The application supports multiple tenants (organizations) using the same codebase with tenant-specific data isolation.

#### Tenant-Specific Collections

Collections that have tenant-specific variants (format: `{tenant}-{collection}`):
- `bookings`
- `bookingLogs`
- `bookingTypes` (some tenants)
- `blackoutPeriods`
- `operationHours`
- `preBanLogs`
- `usersWhitelist`
- `usersApprovers`
- `usersRights`
- `counters`

#### Tenant-Agnostic Collections

Collections shared across all tenants:
- `usersSuperAdmin` (intentionally global)
- `usersBanned`
- `resources`
- `departments`
- `settings`
- `policySettings`
- `tenantSchema`

#### Tenant Identification

- **URL Pattern:** `/{tenant}/...`
- **Examples:**
  - Media Commons: `/mc/...`
  - ITP: `/itp/...`
- **Fallback:** Environment variable or header `x-tenant`

#### Helper Functions

```typescript
// Get tenant-specific collection name
getTenantCollectionName(baseCollection: string, tenant?: string): string

// Get tenant-specific table name from enum
getTenantTableName(tableName: TableNames, tenant?: string): string

// Extract tenant from collection name
extractTenantFromCollectionName(collectionName: string): string | undefined
```

#### Constants

```typescript
import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
// Default tenant used when no tenant specified
```

---

## Developer Terminology

### Preferred Terms (Use These)

#### Database
- **Database** - Firestore database instance
- **Collection** - Group of documents (like a table)
- **Document** - Individual record (like a row)
- **Field** - Document property (like a column)
- **Schema** - Structure definition

#### Naming Conventions
- **camelCase** - For all database table and field names
- **PascalCase** - For TypeScript types and enums
- **kebab-case** - For URL segments and file names

#### Code Organization
- Use consistent terminology between:
  - User-facing UI
  - Code/variables
  - Database schema
  - Documentation

### Deprecated Terms (Avoid These)

- ❌ **Table** → Use "Collection"
- ❌ **Column** → Use "Field"  
- ❌ **Record** → Use "Document"
- ❌ **User** (as group) → Use "Tenant"
- ❌ **Client** (as tenant) → Use "Tenant"
- ❌ **Biz partner** → Use "Tenant" or "Client" (external)

### Database Environments

- **default** - Development/default database (use this for dev)
- **prod** - Production database

### Role-Specific Terminology

| Generic Term | Media Commons Term | Use in Code | Use in UI |
|--------------|-------------------|-------------|-----------|
| Approver | Liaison | Approver | Liaison (MC), Approver (ITP) |
| Worker | PA (Production Assistant) | Worker | PA (MC), Worker (ITP) |
| Admin | Admin | Admin | Admin |
| Super Admin | Super Admin | SuperAdmin | Super Admin |

---

## Migration Notes

### User Collection Consolidation

The application is in the process of migrating from multiple user collections to a single consolidated `usersRights` collection.

#### Migration Script
- **Location:** `/scripts/mergeUsersCollections.js`
- **Usage:** `node scripts/mergeUsersCollections.js [tenant]`
- **What it does:**
  1. Reads from `usersAdmin`, `usersPa`, `usersSuperAdmin`
  2. Merges users by email (deduplicates)
  3. Sets appropriate boolean flags (`isAdmin`, `isWorker`, etc.)
  4. Writes to `usersRights` collection
  5. **Note:** Super admins are NOT written to `usersRights` - they stay in `usersSuperAdmin`

#### Migration Status
- ✅ `usersRights` collection is the current standard
- ⏳ Legacy collections (`usersAdmin`, `usersPa`) still exist but marked as LEGACY
- 🔄 Code supports both legacy and new collections during transition
- 🎯 Future: Remove legacy collections entirely

#### For New Development
- **DO:** Use `TableNames.USERS_RIGHTS` and query by `isAdmin`, `isWorker`, etc.
- **DON'T:** Create new documents in `usersAdmin` or `usersPa`
- **DO:** Use `clientSaveUserRightsData` and `clientDeleteUserRightsData` functions

---

## Data Relationships

### Key Relationships

```
User (email)
├── usersRights (permissions)
├── usersApprovers (if liaison)
│   └── departments (responsible for)
├── usersSuperAdmin (if super admin)
├── bookings (created by user)
│   ├── bookingLogs (change history)
│   ├── preBanLogs (violations)
│   └── resources (rooms booked)
└── usersBanned (if banned)

Booking
├── resources (room/location)
├── bookingLogs (history)
├── bookingTypes (category)
├── User (requester)
└── Google Calendar Event (external)

Tenant
├── {tenant}-bookings
├── {tenant}-bookingLogs
├── {tenant}-usersRights
├── {tenant}-usersApprovers
├── {tenant}-blackoutPeriods
├── {tenant}-operationHours
└── {tenant}-preBanLogs
```

---

## Best Practices

### When Creating a Booking
1. Check user permissions (`usersRights`)
2. Validate against `blackoutPeriods`
3. Check `operationHours`
4. Verify room availability via calendar
5. Determine initial status based on tenant config
6. For XState tenants: Initialize state machine with context
7. Log initial state to `bookingLogs`
8. Send confirmation email

### When Updating User Permissions
1. Query `usersRights` by email
2. Update only the specific permission flags needed
3. **Never** create duplicate entries
4. If no permissions remain, delete the document
5. For super admins, update `usersSuperAdmin` separately

### When Implementing New Features
1. Check if tenant-specific behavior is needed
2. Use helper functions for tenant collection names
3. Consider XState vs. non-XState tenant differences
4. Log significant changes to appropriate log collection
5. Update this documentation!

---

## Troubleshooting

### Duplicate User Records
**Symptom:** User appears in multiple collections
**Cause:** Legacy architecture before `usersRights` consolidation
**Solution:** Run migration script: `node scripts/mergeUsersCollections.js [tenant]`

### Permission Issues
**Symptom:** User can't access expected pages
**Solution:**
1. Check `usersRights` collection for user's email
2. Verify correct boolean flags are set
3. For super admins, check `usersSuperAdmin` collection
4. Check tenant-specific collection (may need tenant prefix)

### Booking Not Transitioning States
**Symptom:** Booking stuck in one state
**Solution:**
1. Check `bookingLogs` for error messages
2. For XState tenants, inspect `xstateData` field
3. Verify user has required permissions for action
4. Check if service-specific approvals are pending

---

## Additional Resources

- **README.md** - Setup and installation instructions
- **scripts/mergeUsersCollections.js** - User collection migration script
- **components/src/policy.ts** - Core enums and collection names
- **components/src/types.ts** - TypeScript type definitions
- **lib/stateMachines/** - XState machine implementations

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Maintainers:** ITP Development Team

For questions or updates to this documentation, please contact the development team or open an issue in the repository.
