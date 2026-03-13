# Initial Page Load Performance Optimization

## Problem

The app takes ~5-10 seconds on initial load. Users see a blank page while the client-side `DatabaseProvider` fetches permission data from Firestore.

## Root Causes

1. **DatabaseProvider blocks rendering** — 4 parallel Firestore reads (adminUsers, paUsers, superAdminUsers, approverUsers) must complete before the home page renders anything, even though ~90% of users are regular booking users who don't need this data.
2. **BookingProvider mounted globally** — Calendar events for ALL rooms are fetched on every page (including admin pages) because `BookingProvider` wraps the entire app via `ClientProvider`.
3. **Duplicate data fetches** — `tenantSchema` is fetched server-side in `layout.tsx` AND client-side in `Provider.tsx`. `USERS_RIGHTS` collection is read twice (once for admins, once for PAs).
4. **App Engine F1 instances** — Smallest instance class (0.6 GB RAM) adds cold-start latency to every Firestore query.
5. **No browser caching** — Calendar events API has `Cache-Control: no-store` despite data changing infrequently.

## Implementation Plan

### Phase 1: Quick Wins (Low Risk, Independent Commits)

#### 1A. Upgrade App Engine instance class (F1 → F2)

| File | Change |
|------|--------|
| `app.production.yaml` | `instance_class: F1` → `F2` |
| `app.development.yaml` | `instance_class: F1` → `F2` |
| `app.staging.yaml` | `instance_class: B1` → `B2` |

F2 doubles RAM (1.2 GB) and CPU. Reduces Firestore cold-start latency by ~50%. Cost increase is ~$5-10/month.

#### 1B. Eliminate duplicate tenantSchema fetch

**File**: `components/src/client/routes/components/Provider.tsx`

`fetchRoomSettings()` (lines 621-665) calls `GET /api/tenantSchema/{tenant}` to get room data, but this exact data is already available in `SchemaContext` (fetched server-side in `app/[tenant]/layout.tsx`).

**Change**: Read from `useTenantSchema()` context instead of making a redundant API call. Map `resources` array to `roomSettings` format directly.

**Saves**: 1 API round-trip + 1 Firestore read per page load.

#### 1C. Merge duplicate USERS_RIGHTS Firestore reads

**File**: `components/src/client/routes/components/Provider.tsx`

`fetchAdminUsers()` (line 354) and `fetchPaUsers()` (line 382) both call `clientFetchAllDataFromCollection(USERS_RIGHTS)` — the same Firestore collection read twice, then filtered differently.

**Change**: Single `fetchUsersRights()` function that reads the collection once and sets both `adminUsers` (filter: `isAdmin === true`) and `paUsers` (filter: `isWorker === true`).

**Saves**: 1 Firestore read in the blocking `Promise.all` (4 reads → 3).

#### 1D. Add Cache-Control to calendar events API

| File | Change |
|------|--------|
| `app/api/calendarEvents/route.ts` | `no-store, no-cache` → `public, max-age=60, stale-while-revalidate=120` |
| `next.config.mjs` headers() | Update `/api/calendarEvents` entry to match |

Calendar data rarely changes within a minute. Browser cache avoids redundant fetches on navigation.

---

### Phase 2: Defer Non-Essential Loading (Medium Effort)

#### 2A. Optimistic rendering for booking users

**File**: `app/[tenant]/page.tsx`

Currently line 32: `if (permissionsLoading) return null` — the home page renders nothing while permissions load.

**Change**: Render `<MyBookingsPage />` immediately. The `pagePermission` useMemo already defaults to `BOOKING` when user lists are empty. Admin/PA users get redirected once permissions resolve (brief flash is acceptable).

**File**: `components/src/client/routes/components/Provider.tsx`

Split `permissionsLoading` into two states:
- `permissionsLoading` → set `false` immediately once we have `user.email`
- `permissionsResolved` → set `true` after admin/PA/superAdmin data actually loads

#### 2B. Route-based permission loading

**File**: `components/src/client/routes/components/Provider.tsx`

Use `usePathname()` to conditionally fetch admin data:
- **Booking routes** (`/book`, `/my-bookings`, tenant root): Skip the `Promise.all` entirely. Set `permissionsLoading = false` immediately.
- **Admin routes** (`/admin`, `/pa`, `/liaison`, `/services`, `/super`): Current behavior (fetch all 4 collections).
- Add a `useEffect` that triggers permission fetch when navigating to an admin route.

---

### Phase 3: Move BookingProvider Out of Global Wrapper (Larger Refactor)

#### 3A. Remove BookingProvider from ClientProvider

**File**: `components/src/client/routes/components/ClientProvider.tsx` line 16

Remove `<BookingProvider>` from the global wrapper. A TODO comment already exists on line 13 noting this should be done.

#### 3B. Add BookingProvider to route-specific layouts

Add `<BookingProvider>` wrapper to only the routes that need it:

| Route Layout | Reason |
|-------------|--------|
| `app/[tenant]/book/layout.tsx` | Booking flow uses BookingContext |
| `app/[tenant]/walk-in/` layout | Walk-in flow uses BookingContext |
| `app/[tenant]/vip/` layout | VIP flow uses BookingContext |
| `app/[tenant]/admin/` layout | Admin hooks (`useExistingBooking`, `useBookingActions`) use BookingContext |
| `app/[tenant]/edit/` layout | Edit flow uses BookingContext |

**Audit required**: 20 files import `BookingContext` — all must be within a `<BookingProvider>`.

**Impact**: Calendar events for ALL rooms will no longer be fetched on home page, my-bookings page, sign-in page, or approval/decline pages.

---

## Key Files

| File | Role |
|------|------|
| `components/src/client/routes/components/Provider.tsx` | Permission loading, duplicate fetches |
| `components/src/client/routes/components/ClientProvider.tsx` | BookingProvider global wrapping |
| `app/[tenant]/page.tsx` | Home page render-blocking guard |
| `app/api/calendarEvents/route.ts` | Cache-Control headers |
| `app.production.yaml` / `app.development.yaml` / `app.staging.yaml` | Instance class config |
| `next.config.mjs` | API cache headers config |

## Expected Results

| Phase | Expected Improvement |
|-------|---------------------|
| Phase 1 | 2-4 seconds faster (fewer requests, faster instance) |
| Phase 2 | Near-instant home page render for booking users |
| Phase 3 | Eliminate unnecessary calendar fetches on non-booking pages |

## Verification

- **Phase 1**: Check Network tab for fewer requests. Compare DevTools Performance FCP before/after.
- **Phase 2**: Time-to-first-paint of home page should be near-instant after auth.
- **Phase 3**: Verify zero `/api/calendarEvents` requests on home/admin pages. Verify booking flow still works.
- **All phases**: Run existing E2E and unit tests.
