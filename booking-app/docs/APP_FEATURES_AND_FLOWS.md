# Booking App - Comprehensive Features & Flows Documentation

> **Last Updated:** March 2026
> **Application:** NYU Media Commons / ITP Booking System
> **Stack:** Next.js (App Router), Firebase Firestore, Google Calendar API, XState v5, Material-UI

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Multi-Tenant Architecture](#2-multi-tenant-architecture)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Booking Flows](#4-booking-flows)
5. [Booking Lifecycle & State Machines](#5-booking-lifecycle--state-machines)
6. [Auto-Approval Logic](#6-auto-approval-logic)
7. [Service Management (Media Commons)](#7-service-management-media-commons)
8. [Room & Resource Configuration](#8-room--resource-configuration)
9. [Admin Panel & Settings](#9-admin-panel--settings)
10. [Calendar Integration](#10-calendar-integration)
11. [Email & Notification System](#11-email--notification-system)
12. [Automated Cron Jobs](#12-automated-cron-jobs)
13. [Safety Training & Compliance](#13-safety-training--compliance)
14. [Ban & Pre-Ban System](#14-ban--pre-ban-system)
15. [Blackout Periods](#15-blackout-periods)
16. [Equipment Checkout](#16-equipment-checkout)
17. [Authentication & Authorization](#17-authentication--authorization)
18. [Data Models](#18-data-models)
19. [API Reference](#19-api-reference)
20. [Route Map](#20-route-map)

---

## 1. System Overview

The Booking App is a multi-tenant room/space reservation system built for NYU. It supports two primary tenants:

- **Media Commons (MC)** - Complex multi-level approval workflows with parallel service management
- **ITP** - Streamlined booking with auto-approval capabilities

Key capabilities:
- Multi-step booking form with role-based field display
- Two-level approval workflow (Liaison → Final Approver)
- Auto-approval for eligible bookings
- Walk-in and VIP booking flows
- Google Calendar synchronization
- Equipment checkout tracking
- Safety training enforcement
- Automated email notifications at every status change
- Cron-based auto-checkout and auto-cancel of declined bookings
- Booking modification and editing
- Service request management (staff, equipment, catering, cleaning, security, setup)
- Blackout period enforcement
- Ban/pre-ban user management
- Booking history audit trail

---

## 2. Multi-Tenant Architecture

### Tenant Configuration

Each tenant has a schema stored in Firestore (`tenantSchema` collection) that controls:

| Setting | Description |
|---------|-------------|
| `name` | Display name of the tenant |
| `logo` | Logo image path |
| `policy` | HTML policy text shown during booking |
| `roles` | Available user roles |
| `resources` | Rooms/spaces available for booking |
| `programMapping` | Maps programs to departments |
| `schoolMapping` | Maps schools to departments |
| `roleMapping` | Maps roles to base role categories |
| `showNNumber` | Whether N-Number field is displayed |
| `showSponsor` | Whether sponsor fields are displayed |
| `showSetup` | Whether room setup options are shown |
| `showEquipment` | Whether equipment services are shown |
| `showStaffing` | Whether staffing services are shown |
| `showCatering` | Whether catering options are shown |
| `showHireSecurity` | Whether security hire option is shown |
| `showBookingTypes` | Whether booking type dropdown is shown |
| `supportVIP` | Whether VIP booking flow is enabled |
| `supportWalkIn` | Whether walk-in booking flow is enabled |
| `agreements` | Checkbox agreements users must accept |
| `emailMessages` | Customizable email templates per status |
| `declinedGracePeriod` | Hours before auto-canceling declined bookings |
| `calendarConfig` | Calendar display settings (start hour, slot units) |
| `timeSensitiveRequestWarning` | Warning for last-minute bookings |

### Tenant Routing

- URL structure: `/{tenant}/...` (e.g., `/mc/book`, `/itp/admin`)
- Root page (`/`) shows tenant selector with links to `/mc` and `/itp`
- Middleware redirects unprefixed routes to `/mc` by default
- Each tenant has isolated Firestore collections: `{tenant}-bookings`, `{tenant}-bookingLogs`, etc.

### Allowed Tenants

| Key | URL Prefix | Description |
|-----|-----------|-------------|
| MC | `/mc` | Media Commons |
| ITP | `/itp` | ITP / IMA / Low Res |

---

## 3. User Roles & Permissions

### User Roles (Booking Form)

| Role | Base Role | Description |
|------|-----------|-------------|
| Student | `student` | NYU student |
| Resident/Fellow | `student` | NYU resident or fellow |
| Faculty | `faculty` | NYU faculty member |
| Admin/Staff | `admin` | Administrative staff |
| Chair/Program Director | `admin` | Department leadership |

Base roles determine booking hour limits and auto-approval eligibility.

### System Permission Levels

| Level | Permission | Access |
|-------|-----------|--------|
| 0 | USER (BOOKING) | Create/view own bookings, cancel own bookings |
| 1 | PA | All USER permissions + manage day-of operations (check-in/out, no-show) |
| 2 | LIAISON | All PA permissions + first-level approval/decline for department bookings |
| 3 | SERVICES | All USER permissions + approve/decline/closeout individual services |
| 4 | ADMIN | Full access to all bookings, settings, and management features |
| - | SUPER_ADMIN | All ADMIN permissions + manage admin/super-admin user accounts |

### Permission Hierarchy

```
SUPER_ADMIN
  └── ADMIN
        ├── SERVICES
        ├── LIAISON
        │     └── PA
        │           └── USER (BOOKING)
        └── USER (BOOKING)
```

### Approver Levels

| Level | Type | Role |
|-------|------|------|
| 1 | FIRST (Liaison) | Department-level first approval |
| 2 | FINAL (Admin) | Final booking approval |
| 3 | EQUIPMENT | Equipment checkout approval |

---

## 4. Booking Flows

### 4.1 Standard Booking Flow (`/book`)

```
Landing Page (Policy Acceptance)
    │
    ▼
Role & Affiliation Selection
    │  - Select School → Department (auto-mapped)
    │  - Select Role (Student, Faculty, Admin/Staff, etc.)
    │  - Auto-fill from NYU ID if available
    │
    ▼
Room & Time Selection
    │  - Select room(s) from checkbox list
    │  - Visual calendar with time slots
    │  - Click/drag to select time range
    │  - See existing bookings, blackout periods
    │  - Validation: duration limits, blackout, overlap
    │
    ▼
Booking Details Form
    │  - Personal info (name, NetID, N-Number, phone, email)
    │  - Event details (title, description, booking type, attendance)
    │  - Services (conditional on room capabilities):
    │      - Room Setup + details
    │      - Equipment Services
    │      - Staffing Services (audio tech, lighting, etc.)
    │      - Catering (NYU Plated, Outside Catering)
    │      - Cleaning (CBS Cleaning)
    │      - Hire Security
    │  - Sponsor info (optional)
    │  - Agreements (must accept all)
    │  - Validation alerts:
    │      - Auto-approval eligibility indicator
    │      - Safety training requirement
    │      - Ban status block
    │      - Blackout period warning
    │      - Duration limit violation
    │      - Time-sensitive booking warning
    │      - Overlap conflict warning
    │
    ▼
Confirmation
    │  - Submit booking request
    │  - Show success/error state
    │  - Link to "View Bookings"
    │
    ▼
Booking enters state machine → REQUESTED (or auto-approved → APPROVED)
```

### 4.2 Walk-In Booking Flow (`/walk-in`)

Walk-in bookings are created by staff (PAs, Admins) on behalf of a visitor.

```
Walk-In Landing Page
    │
    ▼
NetID Entry
    │  - Enter the walk-in person's NetID
    │  - Validates: NetID must differ from the requester's NetID
    │  - Walk-in person's safety training is checked (not the PA's)
    │
    ▼
Role & Affiliation Selection (for walk-in person)
    │
    ▼
Room Selection
    │  - Only rooms with isWalkIn=true are shown
    │  - Walk-in-specific hour limits apply
    │
    ▼
Booking Details Form → Confirmation
    │
    ▼
Booking auto-approved → APPROVED (walk-ins bypass approval)
```

**Walk-In Conditions:**
- Only rooms flagged `isWalkIn: true` are available
- Some rooms allow booking 2 consecutive hours (`isWalkInCanBookTwo`)
- Walk-in bookings auto-approve (skip approval queue)
- Walk-in person's safety training and ban status are checked
- Origin is set to `BookingOrigin.WALK_IN`

### 4.3 VIP Booking Flow (`/vip`)

VIP bookings are expedited bookings typically created by admins.

```
VIP Landing Page
    │
    ▼
Role & Affiliation Selection (VIP context)
    │
    ▼
Room & Time Selection → Booking Details Form → Confirmation
    │
    ▼
Booking auto-approved → APPROVED (VIP bypasses approval)
```

**VIP Conditions:**
- VIP-specific hour limits per role apply
- VIP bookings auto-approve (skip approval queue)
- Only available if tenant schema has `supportVIP: true`
- Origin is set to `BookingOrigin.VIP`

### 4.4 Edit Booking Flow (`/edit/[id]`)

For editing existing bookings (available when booking is in DECLINED status for users, or any editable status for admins).

```
Edit Landing (loads existing booking by calendarEventId)
    │
    ▼
Role Selection → Room Selection → Booking Details Form
    │  - Pre-filled with existing booking data
    │  - User can modify fields
    │
    ▼
Submit edit → Booking returns to REQUESTED status
```

### 4.5 Modification Flow (`/modification/[id]`)

For requesting modifications to an existing approved booking.

```
Modification Landing (loads existing booking by calendarEventId)
    │
    ▼
Modification Form → Room Selection → Confirmation
    │  - Pre-filled with existing data
    │  - Modifications tracked separately
    │
    ▼
Submit modification → Booking updated
```

---

## 5. Booking Lifecycle & State Machines

The system uses XState v5 state machines to manage booking lifecycles. Each tenant has its own machine definition.

### 5.1 ITP Booking State Machine

```
                    ┌──────────┐
                    │ Requested │◄──────── (edit from Declined)
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
         [auto-approve]  │     [decline]
              │      [approve]      │
              │          │          │
              ▼          ▼          ▼
         ┌─────────┐  ┌────────┐  ┌──────────┐
         │ Approved │  │Approved│  │ Declined │
         └────┬────┘  └───┬────┘  └────┬─────┘
              │            │            │
              └──────┬─────┘      [24h timeout]
                     │                  │
         ┌───────────┼──────────┐       ▼
         │           │          │  ┌──────────┐
     [cancel]    [check-in]  [no-show]│Canceled│
         │           │          │  └────┬─────┘
         ▼           ▼          ▼       │
    ┌────────┐ ┌──────────┐ ┌────────┐  ▼
    │Canceled│ │Checked In│ │No Show │ ┌──────┐
    └───┬────┘ └────┬─────┘ └───┬────┘ │Closed│
        │           │            │      └──────┘
        ▼       [check-out]      ▼
    ┌──────┐        │       ┌────────┐
    │Closed│        ▼       │Canceled│
    └──────┘  ┌───────────┐ └───┬────┘
              │Checked Out│     │
              └─────┬─────┘     ▼
                    │       ┌──────┐
                [close]     │Closed│
                    │       └──────┘
                    ▼
               ┌──────┐
               │Closed│
               └──────┘
```

**ITP States & Transitions:**

| State | Event | Target | Guard/Condition | Side Effects |
|-------|-------|--------|-----------------|--------------|
| Requested | (auto) | Approved | `shouldAutoApprove` | - |
| Requested | approve | Approved | - | Email + calendar update |
| Requested | decline | Declined | - | Email + calendar update |
| Requested | cancel | Canceled | - | Email + calendar delete |
| Requested | edit | Requested | - | - |
| Declined | edit | Requested | - | - |
| Declined | (24h timeout) | Canceled | - | Auto-cancel |
| Approved | checkIn | Checked In | - | Email + calendar update |
| Approved | cancel | Canceled | - | Email + calendar delete |
| Approved | noShow | No Show | - | Email + calendar update |
| Approved | Modify | Approved | - | - |
| Approved | autoCloseScript | Closed | - | - |
| Checked In | checkOut | Checked Out | - | Email + calendar update |
| No Show | (auto) | Canceled | - | Calendar update |
| Checked Out | close | Closed | - | Email + calendar update |
| Canceled | (auto) | Closed | - | Email + calendar delete |

**Entry Actions per State:**
- **Requested**: Create Google Calendar event, send confirmation email
- **Approved**: Send approval email, update calendar event
- **Declined**: Send decline email (with reason), update calendar
- **Canceled**: Send cancellation email, delete calendar event
- **Checked In**: Send check-in email, update calendar
- **Checked Out**: Send checkout email, update calendar
- **Closed**: Send closure email, update calendar

### 5.2 Media Commons Booking State Machine

The MC machine is significantly more complex with parallel states for service management.

```
┌──────────┐
│ Requested │
└────┬─────┘
     │
     ├─[auto-approve]──────────────────────► Approved
     ├─[approve]───────────────────────────► Pre-approved
     ├─[VIP + services]───────────────────► Services Request (parallel)
     ├─[decline]───────────────────────────► Declined
     └─[cancel]────────────────────────────► Canceled
                                               │
┌──────────────┐                               ├─[has services]──► Service Closeout
│ Pre-approved │                               └─[no services]──► Closed
└────┬─────────┘
     │
     ├─[approve + pregame origin]──────────► Approved (auto-approve all services)
     ├─[approve + services approved]───────► Approved
     ├─[approve + services requested]──────► Services Request (parallel)
     ├─[approve + no services]─────────────► Approved
     ├─[decline]───────────────────────────► Declined
     ├─[cancel]────────────────────────────► Canceled
     └─[edit]──────────────────────────────► Requested

┌─────────────────────────────────────────────────────────────┐
│                    Services Request (Parallel)               │
│                                                              │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────┐ │
│  │ Staff Request    │  │ Equipment Request│  │Setup Request│ │
│  │ Evaluate → Req'd │  │ Evaluate → Req'd │  │Eval → Req'd│ │
│  │ → Approved       │  │ → Approved       │  │→ Approved  │ │
│  │ → Declined       │  │ → Declined       │  │→ Declined  │ │
│  └─────────────────┘  └──────────────────┘  └────────────┘ │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────┐ │
│  │Catering Request  │  │ Security Request │  │Clean Request│ │
│  │ Evaluate → Req'd │  │ Evaluate → Req'd │  │Eval → Req'd│ │
│  │ → Approved       │  │ → Approved       │  │→ Approved  │ │
│  │ → Declined       │  │ → Declined       │  │→ Declined  │ │
│  └─────────────────┘  └──────────────────┘  └────────────┘ │
│                                                              │
│  When all services resolved → onDone → Evaluate Services     │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────┐
│ Evaluate Services Request│
│  All approved → Approved │
│  Any declined → Declined │
└──────────────────────────┘

┌──────────┐     ┌───────────┐     ┌─────────────┐
│ Approved │────►│ Checked In│────►│ Checked Out │
└──────────┘     └───────────┘     └──────┬──────┘
     │                                     │
     ├─[cancel]──► Canceled          [has services]──► Service Closeout
     ├─[noShow]──► No Show           [no services]──► Closed
     └─[decline]─► Declined

┌─────────────────────────────────────────────────────────────┐
│                  Service Closeout (Parallel)                  │
│                                                              │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────┐ │
│  │ Staff Closeout   │  │Equipment Closeout│  │Setup Close │ │
│  │ Pending → Done   │  │ Pending → Done   │  │Pending→Done│ │
│  └─────────────────┘  └──────────────────┘  └────────────┘ │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────┐ │
│  │Catering Closeout │  │Security Closeout │  │Clean Close │ │
│  │ Pending → Done   │  │ Pending → Done   │  │Pending→Done│ │
│  └─────────────────┘  └──────────────────┘  └────────────┘ │
│                                                              │
│  When all services closed out → onDone → Closed              │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Booking Statuses

| Status | Label | Description |
|--------|-------|-------------|
| REQUESTED | Requested | Initial state after submission |
| PRE_APPROVED | Pre-approved | First-level (liaison) approval granted |
| APPROVED | Approved | Fully approved, event confirmed |
| CHECKED_IN | Checked In | Guest has arrived and checked in |
| CHECKED_OUT | Checked Out | Guest has departed |
| CLOSED | Closed | Final state, all operations complete |
| DECLINED | Declined | Rejected by an approver |
| CANCELED | Canceled | Canceled by user or system |
| NO_SHOW | No Show | Guest did not arrive |
| WALK_IN | Walk In | Walk-in booking (display only) |

### 5.4 Booking Origins

| Origin | Description |
|--------|-------------|
| `user` | Created by end user through standard booking form |
| `admin` | Created by an admin |
| `walk-in` | Created through walk-in flow |
| `vip` | Created through VIP flow |
| `system` | Created by automated system process |
| `pre-game` | Imported from pre-game calendar sync |

---

## 6. Auto-Approval Logic

Bookings can bypass the approval workflow and be automatically approved if all conditions are met.

### Eligibility Check Order

```
1. VIP or Walk-In?
   └─ YES → Auto-approve ✓

2. Rooms selected?
   └─ NO → Reject (no rooms)

3. All rooms have autoApproval enabled?
   └─ NO → Reject (room not configured for auto-approval)

4. Duration within limits for user's role?
   │  - Check minHours for role (student/faculty/admin)
   │  - Check maxHours for role
   └─ OUT OF RANGE → Reject (duration violation)

5. Services allowed for auto-approval?
   │  - Check each requested service against room.autoApproval.conditions
   │  - Services: setup, equipment, staffing, catering, cleaning, security
   └─ SERVICE NOT ALLOWED → Reject (service requires manual approval)

6. All checks passed → Auto-approve ✓
```

### ITP-Specific Auto-Approval Guard

The ITP machine adds a tenant check before running auto-approval:
1. Verify tenant is `"itp"`
2. Calculate booking duration from calendar info
3. Map form data to services requested format:
   - `setup`: `roomSetup === "yes"`
   - `equipment`: `mediaServices.length > 0`
   - `catering`: `catering === "yes"`
   - `security`: `hireSecurity === "yes"`
4. Call `checkAutoApprovalEligibility()` with context

### MC-Specific Auto-Approval Guard

The MC machine has additional conditions:
1. Reject if booking was restored from existing status (`_restoredFromStatus`)
2. Verify tenant is `"mc"`
3. VIP with services → route to Services Request (not auto-approve)
4. Otherwise follow standard eligibility check

---

## 7. Service Management (Media Commons)

Media Commons supports six parallel service types that are managed independently.

### Service Types

| Service | Form Field | Description |
|---------|-----------|-------------|
| Staff | `staffingServices` | Audio technician, lighting technician |
| Equipment | `equipmentServices` | Equipment checkout |
| Catering | `cateringService` | NYU Plated, Outside Catering |
| Cleaning | `cleaningService` | CBS Cleaning Services |
| Security | `hireSecurity` | Hired security |
| Setup | `roomSetup` | Room arrangement/setup |

### Service Lifecycle

```
Service Requested
    │
    ├── [approve] → Service Approved
    │
    └── [decline] → Service Declined
                        │
                        ▼
                  (may cause overall booking decline
                   if evaluated and any service is declined)
```

### Service Closeout

After a booking is checked out (or canceled), each requested service must be individually closed out:

```
Service Closeout Pending
    │
    └── [closeout] → Service Closed Out
```

All services must be closed out before the booking reaches the final `Closed` state.

### Service Actions

| Action | Event | Description |
|--------|-------|-------------|
| Approve Staff | `approveStaff` | Approve staffing request |
| Decline Staff | `declineStaff` | Decline staffing request |
| Closeout Staff | `closeoutStaff` | Mark staffing as complete |
| Approve Equipment | `approveEquipment` | Approve equipment request |
| Decline Equipment | `declineEquipment` | Decline equipment request |
| Closeout Equipment | `closeoutEquipment` | Mark equipment as returned |
| Approve Catering | `approveCatering` | Approve catering request |
| Decline Catering | `declineCatering` | Decline catering request |
| Closeout Catering | `closeoutCatering` | Mark catering as complete |
| Approve Cleaning | `approveCleaning` | Approve cleaning request |
| Decline Cleaning | `declineCleaning` | Decline cleaning request |
| Closeout Cleaning | `closeoutCleaning` | Mark cleaning as complete |
| Approve Security | `approveSecurity` | Approve security request |
| Decline Security | `declineSecurity` | Decline security request |
| Closeout Security | `closeoutSecurity` | Mark security as complete |
| Approve Setup | `approveSetup` | Approve setup request |
| Decline Setup | `declineSetup` | Decline setup request |
| Closeout Setup | `closeoutSetup` | Mark setup as complete |

### Service Resolution Logic

When all parallel service requests are resolved (all approved or any declined), the machine evaluates:

- **All services approved** → Booking moves to `Approved`
- **Any service declined** → Booking moves to `Declined`

### Pregame Service Handling

Bookings with origin `pre-game` (imported from calendar sync) get all requested services auto-approved when the final approval is granted via `approveAllPregameServices` action.

---

## 8. Room & Resource Configuration

### Room Settings

Each room/resource has extensive configuration:

```typescript
{
  roomId: number,              // Unique room identifier
  name: string,                // Display name
  capacity: string,            // Room capacity
  calendarId: string,          // Google Calendar ID (production)
  calendarIdDev: string,       // Google Calendar ID (development)

  // Feature flags
  needsSafetyTraining: boolean,  // Require safety training completion
  trainingFormUrl: string,       // URL to Google Form for training
  isWalkIn: boolean,             // Available for walk-in bookings
  isWalkInCanBookTwo: boolean,   // Walk-ins can book 2 consecutive hours
  isEquipment: boolean,          // Room involves equipment checkout

  // Available services
  services: string[],            // List of available services
  staffingServices: string[],    // Available staffing options
  staffingSections: [             // Grouped staffing sections
    { name: string, indexes: number[] }
  ],

  // Auto-approval configuration
  autoApproval: {
    conditions: {
      setup: boolean,      // Allow auto-approve with setup
      equipment: boolean,  // Allow auto-approve with equipment
      staffing: boolean,   // Allow auto-approve with staffing
      catering: boolean,   // Allow auto-approve with catering
      cleaning: boolean,   // Allow auto-approve with cleaning
      security: boolean    // Allow auto-approve with security
    }
  },

  // Booking hour limits (per role)
  maxHour: {
    student: number,          faculty: number,          admin: number,
    studentWalkIn: number,    facultyWalkIn: number,    adminWalkIn: number,
    studentVIP: number,       facultyVIP: number,       adminVIP: number
  },
  minHour: {
    student: number,          faculty: number,          admin: number,
    studentWalkIn: number,    facultyWalkIn: number,    adminWalkIn: number,
    studentVIP: number,       facultyVIP: number,       adminVIP: number
  }
}
```

### Operation Hours

Each room can have per-day operating hours:

```typescript
{
  day: "Monday" | "Tuesday" | ... | "Sunday",
  open: number,     // Opening hour (0-23)
  close: number,    // Closing hour (0-23)
  isClosed: boolean, // Room closed this day
  roomId: number     // Associated room
}
```

---

## 9. Admin Panel & Settings

### 9.1 Navigation Bar

The NavBar dynamically shows options based on user role:

| Role | Visible Buttons |
|------|----------------|
| USER | "Book" button |
| PA | "Walk-In" button (if supported) |
| LIAISON | "Walk-In" button (if supported) |
| SERVICES | "Walk-In" button (if supported) |
| ADMIN | "VIP" button (if supported), "Walk-In" button |
| SUPER_ADMIN | All buttons |

Users with multiple roles see a dropdown to switch between role views.

### 9.2 Admin Page

Two tabs:

1. **Bookings Tab**: Full booking table with management actions
2. **Settings Tab**: Access to 11 configuration sections

### 9.3 Settings Sections

#### Safety Training
- View/manage users who completed safety training
- Add/remove users from the trained list
- Track completion dates

#### PA Users
- Add/remove Production Assistant accounts (by email)

#### Admin Users
- Add/remove administrator accounts (by email)
- Only users in this list can access the admin panel

#### Approvers
- **Liaisons**: Department-based first-level approvers
  - Associate each liaison with a department
  - Level 1 (FIRST) approval rights
- **Equipment Users**: Equipment checkout approvers
  - Level 3 (EQUIPMENT) approval rights

#### Departments
- Add/remove departments
- Assign tier: Primary, Secondary, or Tertiary
- Used for liaison routing and booking categorization

#### Pre-ban
- View users with warning flags (late cancellations, no-shows)
- See incident history per user
- Clear warning flags

#### Ban
- Permanently banned users list
- Add/remove by email
- Banned users cannot create any bookings

#### Booking Types
- Define available options for the booking type dropdown
- Add/remove custom types

#### Policy Settings
- **Blackout Periods**: Configure dates/times when bookings are blocked
- **Final Approver**: Designate the final approver email
- **Operational Hours**: Set operating hours per day per room

#### Export Database
- One-click CSV export of all bookings
- File: `bookings_YYYY-MM-DD.csv`

#### Sync Calendars
- **Manual Import**: Import manually created Google Calendar events
- **Pregame Import**: Import pre-event calendar entries
  - Supports dry-run mode for preview before import
  - Shows summary: total events, new bookings, existing bookings, skipped

### 9.4 Liaison Page (`/liaison`)

- Shows bookings filtered to the liaison's department
- First-level approve/decline actions
- Available to: ADMIN, LIAISON, SUPER_ADMIN

### 9.5 PA Page (`/pa`)

- Manages day-of booking operations
- Check-in/check-out actions
- Equipment tracking
- Available to: ADMIN, PA, SUPER_ADMIN

### 9.6 Services Page (`/services`)

- Filters bookings to show only those with service requests
- Approve/decline/closeout individual services
- Available to: ADMIN, SERVICES, SUPER_ADMIN

### 9.7 Super Admin Page (`/super`)

- Manage super admin accounts
- Only accessible by SUPER_ADMIN role

---

## 10. Calendar Integration

### Google Calendar API

The system maintains bidirectional sync with Google Calendar:

**Calendar Event Creation:**
- Created when booking enters `Requested` state
- Event title: booking title
- Event description: structured HTML with all booking details
  - Request info (number, rooms, dates, status, origin)
  - Requester info (NetID, name, school, department, role, contact)
  - Event details (title, description, type, attendance, affiliation)
  - Services info (setup, media, catering, security, equipment)

**Calendar Event Updates:**
- Updated on every status transition (approved, declined, checked-in, etc.)
- Calendar description reflects current booking status

**Calendar Event Deletion:**
- Deleted when booking is canceled

**Calendar Display:**
- Events in these statuses are hidden from the calendar view:
  - NO_SHOW, CANCELED, DECLINED, CHECKED_OUT

### Environment Handling

| Branch | Calendar Used |
|--------|--------------|
| `development` | Development calendar (`calendarIdDev`) |
| `staging` | Production calendar (`calendarId` or `calendarIdProd`) |
| `production` | Production calendar (`calendarId` or `calendarIdProd`) |

### Calendar UI (SelectRoom Page)

- Uses FullCalendar library with resource time grid view
- Displays rooms as vertical columns
- Time slots: 30-minute or 1-hour intervals (configurable per tenant)
- Click/drag to select booking time range
- Shows existing bookings as event blocks
- Blackout periods shown as grayed-out unselectable zones
- Past times are disabled
- Timezone: US Eastern (America/New_York)

---

## 11. Email & Notification System

### Email Infrastructure

- **Delivery**: Gmail API via Google OAuth2
- **Templating**: Handlebars template engine
- **Template**: Single `booking_detail.html` template for all email types
- **Development mode**: Non-admin emails redirected to dev mailing list

### Email Types & Triggers

| Email Type | Trigger | Recipient(s) | Status Shown |
|------------|---------|---------------|--------------|
| Request Confirmation | Booking submitted | Requester | REQUESTED |
| First Approval Request | Booking needs liaison review | Liaison (first approver) | REQUESTED |
| Second Approval Request | First approval granted | Final Approver (admin) | PRE_APPROVED |
| Approval Notice | Booking fully approved | Requester + Final Approver | APPROVED |
| Walk-In Confirmation | Walk-in booking created | Walk-in guest | APPROVED |
| VIP Confirmation | VIP booking created | VIP guest | APPROVED |
| Check-In Confirmation | Guest checked in | Guest | CHECKED_IN |
| Check-Out Confirmation | Guest checked out | Guest | CHECKED_OUT |
| Decline Notification | Booking declined | Requester | DECLINED |
| No-Show Notification | Guest didn't arrive | Guest + Admin | NO_SHOW |
| Cancellation Notification | Booking canceled | Guest | CANCELED |
| Late Cancel Notification | Late cancellation | Guest | CANCELED |
| Closure Notification | Services closed out | Guest | CLOSED |

### Decline Email Details

The decline email includes:
- Decline reason provided by the approver
- List of declined services (if service-level decline)
- Grace period notice: "You have {X} hours to edit your request before it is automatically canceled"
- Link to edit the booking

### No-Show Email Details

The no-show email includes:
- Violation count for the user
- Sent to both the guest and the admin approval CC address

### Email Subject Line Prefixes

| Environment | Prefix |
|------------|--------|
| Development | `[DEV]` |
| Staging | `[STAGING]` |
| Production | (none) |

### Email Content

Each email includes:
- Header message (tenant-configurable per status)
- Booking details table
- Booking history timeline (all status changes with timestamps and actors)
- Approval/edit links (where applicable)

---

## 12. Automated Cron Jobs

### 12.1 Auto-Cancel Declined Bookings

**Endpoint:** `GET /api/bookings/auto-cancel-declined`
**Authentication:** Bearer token (`CRON_SECRET`)
**Supports Dry Run:** `?dryRun=true`

**Logic:**
1. Fetch all DECLINED bookings across all tenant collections
2. Read tenant-specific `declinedGracePeriod` (default: 24 hours)
3. Find bookings declined longer than the grace period ago
4. Verify booking is still in DECLINED state (user may have edited)
5. Execute XState `cancel` transition for each eligible booking
6. Log status change: DECLINED → CANCELED

**Purpose:** Automatically cancel bookings that remain declined past the grace period without user action (editing or resubmission).

### 12.2 Auto-Checkout Bookings

**Endpoint:** `GET /api/bookings/auto-checkout`
**Authentication:** Bearer token (`CRON_SECRET`)
**Supports Dry Run:** `?dryRun=true`

**Logic:**
1. Fetch bookings with end dates in the past 24 hours
2. Filter to only bookings in "Checked In" XState state
3. Verify current time is 30+ minutes past the booking's scheduled end time
4. Execute XState `checkOut` transition for each eligible booking
5. Note: "Auto-checkout: 30 minutes after scheduled end time"

**Purpose:** Automatically check out guests who remain checked in past their booking end time, preventing indefinite checked-in states.

---

## 13. Safety Training & Compliance

### How It Works

1. Certain rooms require safety training (configured per room: `needsSafetyTraining: true`)
2. Training is completed via a Google Form (URL stored per room: `trainingFormUrl`)
3. Completed training is tracked in the `usersWhitelist` collection
4. The system validates training status during booking:
   - For standard bookings: checks the requester's training
   - For walk-in bookings: checks the walk-in person's training (not the PA's)

### Enforcement

- If training is required and not completed:
  - Warning alert shown on the booking form
  - Link to the training form provided
  - Booking submission may be blocked
- Admin can manually add/remove users from the trained list via Settings

---

## 14. Ban & Pre-Ban System

### Pre-Ban (Warning System)

The pre-ban system tracks policy violations:

| Violation Type | Tracked Data |
|---------------|-------------|
| Late Cancellation | `lateCancelDate` - timestamp of the late cancel |
| No-Show | `noShowDate` - timestamp of the no-show |

- Each violation is logged as a `PreBanLog` entry
- Admins can view violation history per user
- Admins can clear warnings (removes all records for the user)
- Accumulated violations can lead to a full ban

### Full Ban

- Banned users are stored in the `usersBanned` collection
- Banned users cannot create any bookings
- The booking form displays a red alert: "You are banned from making bookings"
- The submit button is disabled for banned users
- Admins manage bans via Settings > Ban section

---

## 15. Blackout Periods

### Configuration

```typescript
{
  name: string,          // Descriptive name (e.g., "Winter Break")
  startDate: Timestamp,  // Period start
  endDate: Timestamp,    // Period end
  startTime?: string,    // Optional daily start time (HH:mm)
  endTime?: string,      // Optional daily end time (HH:mm)
  isActive: boolean,     // Whether currently enforced
  roomIds?: number[]     // Specific rooms (empty = all rooms)
}
```

### Enforcement

- Blackout periods appear as grayed-out zones on the calendar
- Users cannot select time slots within blackout periods
- If a booking overlaps with a blackout period, a warning is displayed
- Admins configure blackout periods via Settings > Policy Settings

---

## 16. Equipment Checkout

### Features

- Equipment checkout tracking via web checkout cart system
- Cart number stored per booking (`webcheckoutCartNumber`)
- Equipment checkout status tracked (`equipmentCheckedOut`)
- Cart details viewable via `/api/webcheckout/cart/[cartNumber]`
- Cart updates via `POST /api/updateWebcheckoutCart`

### Equipment Approval

- Equipment requests follow the standard service approval workflow
- Equipment-specific approvers (ApproverLevel.EQUIPMENT) can approve/decline
- Equipment checkout toggle in booking details modal

---

## 17. Authentication & Authorization

### Authentication Flow

1. **Google OAuth**: Primary sign-in via Google OAuth (NYU email required)
2. **NYU Auth API**: Secondary authentication for NYU identity verification
3. **Domain Restriction**: Only `@nyu.edu` email addresses are allowed
4. **Forbidden Page**: Non-NYU users see a 403 page: "Only nyu.edu email addresses are allowed"

### NYU Identity Lookup

- Endpoint: `GET /api/nyu/identity/[uniqueId]`
- Looks up user by NetID or N-Number
- Returns: school, department, affiliation, name, role
- Used to auto-fill form fields from NYU directory

### Token Management

- **Google OAuth tokens**: Cached with auto-refresh (60s before expiry)
- **NYU API tokens**: Singleton `NYUTokenManager` with 5-minute refresh buffer
- **Request coalescing**: Concurrent token requests share a single fetch

### Test Environment

- Auth bypass supported via `shouldBypassAuth()` utility
- Test environment detection via `NEXT_PUBLIC_BRANCH_NAME` or `/api/isTestEnv`

---

## 18. Data Models

### Booking

The central data model containing all booking information:

```
Identity Fields:
  calendarEventId    - Unique Google Calendar event identifier
  email              - Requester's email
  requestNumber      - Sequential booking number

Personal Information:
  firstName, lastName, secondaryName
  nNumber            - NYU ID number
  netId              - NYU NetID
  walkInNetId        - Walk-in person's NetID (walk-in flow only)
  phoneNumber
  school, department, role

Event Details:
  title              - Event title
  description        - Event description
  bookingType        - Type of booking
  attendeeAffiliation - NYU/Non-NYU/Both
  expectedAttendance - Expected number of attendees

Room & Time:
  roomId             - Selected room identifier
  startDate          - Booking start timestamp
  endDate            - Booking end timestamp

Services:
  roomSetup, setupDetails
  mediaServices, mediaServicesDetails
  equipmentServices, equipmentServicesDetails
  staffingServices, staffingServicesDetails
  catering, cateringService
  hireSecurity, cleaningService
  chartFieldForCatering, chartFieldForCleaning
  chartFieldForSecurity, chartFieldForRoomSetup

Sponsor:
  sponsorFirstName, sponsorLastName, sponsorEmail

Status Timeline:
  requestedAt / requestedBy
  firstApprovedAt / firstApprovedBy
  finalApprovedAt / finalApprovedBy
  declinedAt / declinedBy / declineReason
  canceledAt / canceledBy
  checkedInAt / checkedInBy
  checkedOutAt / checkedOutBy
  noShowedAt / noShowedBy
  closedAt / closedBy
  walkedInAt

Service Approval Flags:
  staffServiceApproved
  equipmentServiceApproved
  cateringServiceApproved
  cleaningServiceApproved
  securityServiceApproved
  setupServiceApproved

State Management:
  origin             - BookingOrigin enum
  xstateData         - Persisted XState snapshot
  equipmentCheckedOut - Equipment checkout status
  webcheckoutCartNumber - Cart reference
```

### Booking Log (Audit Trail)

```
  id                 - Log entry ID
  bookingId          - Associated booking
  calendarEventId    - Calendar event reference
  requestNumber      - Booking request number
  status             - Status at time of change
  changedBy          - Email of user who made the change
  changedAt          - Timestamp of change
  note               - Optional note/reason
```

### Firestore Collections

| Collection Name | Tenant-Scoped | Description |
|----------------|---------------|-------------|
| `bookings` | Yes (`{tenant}-bookings`) | All booking records |
| `bookingLogs` | Yes | Booking change audit trail |
| `bookingTypes` | Yes | Available booking types |
| `blackoutPeriods` | Yes | Blackout period definitions |
| `counters` | Yes | Sequential ID counters |
| `operationHours` | Yes | Room operation hours |
| `preBanLogs` | Yes | Pre-ban violation records |
| `usersWhitelist` | Yes | Safety-trained users |
| `usersApprovers` | Yes | Approver accounts |
| `usersRights` | Yes | User permission assignments |
| `usersAdmin` | No | Admin user accounts |
| `usersPa` | No | PA user accounts |
| `usersBanned` | No | Banned users |
| `usersSuperAdmin` | No | Super admin accounts |
| `resources` | No | Room/space definitions |
| `departments` | No | Department definitions |
| `settings` | No | System settings |
| `policySettings` | No | Policy configuration |
| `tenantSchema` | No | Tenant schema definitions |

---

## 19. API Reference

### Booking Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bookings` | Fetch bookings |
| POST | `/api/bookings` | Create new booking (initializes XState) |
| POST | `/api/bookings/edit` | Edit existing booking |
| POST | `/api/bookings/modification` | Request booking modification |
| GET | `/api/bookings/export` | Export bookings as CSV |
| POST | `/api/bookingsDirect` | Create booking directly (walk-in/VIP) |

### State Transitions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/approve` | Approve a booking |
| POST | `/api/xstate-transition` | Execute any XState event |
| GET | `/api/xstate-transition` | Query available transitions for current state |

### Processing

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/cancel-processing` | Process booking cancellation side effects |
| POST | `/api/checkout-processing` | Process checkout side effects |
| POST | `/api/close-processing` | Process booking closure side effects |

### Automation

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bookings/auto-cancel-declined` | Cron: auto-cancel declined bookings |
| GET | `/api/bookings/auto-checkout` | Cron: auto-checkout expired bookings |

### Calendar & Sync

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/calendarEvents` | Fetch calendar events with booking status |
| POST | `/api/syncCalendars` | Sync Google Calendar with Firestore |
| POST | `/api/syncSemesterPregameBookings` | Import pregame bookings |

### Users & Identity

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/nyu/identity/[uniqueId]` | NYU identity lookup by NetID/N-Number |
| POST | `/api/inviteUser` | Invite user to calendar event |
| GET | `/api/liaisons` | List liaison contacts |

### Email

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sendEmail` | Send HTML email via Gmail API |
| POST | `/api/sendConfirmationEmail` | Send booking detail email |

### Safety Training

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/safety_training_form` | Safety training form management |
| GET | `/api/safety_training_users` | List safety-trained users |

### Equipment & Services

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/equipment` | Get equipment inventory |
| GET | `/api/services` | Get available services |
| GET | `/api/webcheckout/cart/[cartNumber]` | Get web checkout cart details |
| POST | `/api/updateWebcheckoutCart` | Update web checkout cart |

### Data & Configuration

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/getData` | Fetch general data |
| GET | `/api/booking-logs` | Get booking history logs |
| GET | `/api/tenantSchema/[tenant]` | Get tenant configuration |
| GET | `/api/isTestEnv` | Check if test environment |

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/callback` | OAuth callback (code → tokens) |

### Database Administration

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/db/addFields` | Add fields to database records |
| POST | `/api/db/duplicate` | Duplicate database records |
| POST | `/api/db/merge` | Merge database records |
| POST | `/api/db/refactor` | Refactor database structure |

---

## 20. Route Map

### Public Routes

| Route | Description |
|-------|-------------|
| `/` | Root landing page (tenant selector) |
| `/signin` | Global sign-in page |
| `/[tenant]/signin` | Tenant-specific sign-in |
| `/[tenant]/forbidden` | 403 page for non-NYU users |

### User Routes

| Route | Description | Form Context |
|-------|-------------|-------------|
| `/[tenant]` | My Bookings (home) | - |
| `/[tenant]/my-bookings` | My Bookings list | - |
| `/[tenant]/book` | Booking flow: policy | FULL_FORM |
| `/[tenant]/book/role` | Booking flow: role selection | FULL_FORM |
| `/[tenant]/book/selectRoom` | Booking flow: room & time | FULL_FORM |
| `/[tenant]/book/form` | Booking flow: details form | FULL_FORM |
| `/[tenant]/book/confirmation` | Booking flow: confirmation | FULL_FORM |

### Walk-In Routes

| Route | Description | Form Context |
|-------|-------------|-------------|
| `/[tenant]/walk-in` | Walk-in landing | WALK_IN |
| `/[tenant]/walk-in/netid` | Walk-in NetID entry | WALK_IN |
| `/[tenant]/walk-in/role` | Walk-in role selection | WALK_IN |
| `/[tenant]/walk-in/selectRoom` | Walk-in room selection | WALK_IN |
| `/[tenant]/walk-in/form` | Walk-in details form | WALK_IN |
| `/[tenant]/walk-in/confirmation` | Walk-in confirmation | WALK_IN |

### VIP Routes

| Route | Description | Form Context |
|-------|-------------|-------------|
| `/[tenant]/vip` | VIP landing | VIP |
| `/[tenant]/vip/role` | VIP role selection | VIP |
| `/[tenant]/vip/selectRoom` | VIP room selection | VIP |
| `/[tenant]/vip/form` | VIP details form | VIP |
| `/[tenant]/vip/confirmation` | VIP confirmation | VIP |

### Edit & Modification Routes

| Route | Description | Form Context |
|-------|-------------|-------------|
| `/[tenant]/edit/[id]` | Edit booking landing | EDIT |
| `/[tenant]/edit/role/[id]` | Edit role selection | EDIT |
| `/[tenant]/edit/selectRoom/[id]` | Edit room selection | EDIT |
| `/[tenant]/edit/form/[id]` | Edit details form | EDIT |
| `/[tenant]/modification/[id]` | Modification landing | MODIFICATION |
| `/[tenant]/modification/form/[id]` | Modification form | MODIFICATION |
| `/[tenant]/modification/selectRoom/[id]` | Modification room selection | MODIFICATION |
| `/[tenant]/modification/confirmation` | Modification confirmation | MODIFICATION |

### Approval Routes

| Route | Description |
|-------|-------------|
| `/[tenant]/approve?calendarEventId=X` | Approve booking (standalone) |
| `/[tenant]/decline?calendarEventId=X` | Decline booking (standalone, requires reason) |

### Management Routes

| Route | Description | Required Permission |
|-------|-------------|-------------------|
| `/[tenant]/admin` | Admin dashboard | ADMIN, SUPER_ADMIN |
| `/[tenant]/liaison` | Liaison dashboard | LIAISON, ADMIN, SUPER_ADMIN |
| `/[tenant]/pa` | PA dashboard | PA, ADMIN, SUPER_ADMIN |
| `/[tenant]/services` | Services dashboard | SERVICES, ADMIN, SUPER_ADMIN |
| `/[tenant]/super` | Super admin dashboard | SUPER_ADMIN |

---

## Appendix: Google API Integrations

| API | Purpose |
|-----|---------|
| Google Calendar API v3 | Create/update/delete booking events |
| Gmail API v1 | Send notification emails |
| Google Sheets API v4 | Export/sync booking data |
| Google Forms API v1 | Safety training form integration |
| Google Cloud Logging API v2 | Application logging |
| NYU Auth API (OAuth2) | NYU identity verification |

---

## Appendix: Environment Configuration

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_BRANCH_NAME` | Environment identifier (development/staging/production) |
| `CRON_SECRET` | Authentication for cron job endpoints |
| `GOOGLE_REFRESH_TOKEN` | Google API OAuth refresh token |
| `NEXT_PUBLIC_BASE_URL` | Application base URL |

| Branch | Environment | Calendar | Email Prefix |
|--------|------------|----------|-------------|
| `development` | Dev | Development calendars | `[DEV]` |
| `staging` | Staging | Production calendars | `[STAGING]` |
| `production` | Production | Production calendars | (none) |
