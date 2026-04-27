# Migration Plan: Firebase Authentication to NYU SSO (OpenID Connect)

**Issue:** [#685](https://github.com/ITPNYU/booking-app/issues/685)
**Status:** Planning
**Last Updated:** 2026-03-27

---

## Table of Contents

1. [Current State](#1-current-state)
2. [Target State](#2-target-state)
3. [Impact Analysis](#3-impact-analysis)
4. [Migration Strategy](#4-migration-strategy)
5. [Implementation Steps](#5-implementation-steps)
6. [Risk Assessment](#6-risk-assessment)
7. [Open Questions](#7-open-questions)

---

## 1. Current State

### Authentication Flow

The app currently uses **Firebase Authentication with Google Sign-In**, restricted to `@nyu.edu` emails.

```
User clicks "Sign in with NYU Google Account"
  -> Firebase Google OAuth (popup on localhost, redirect on deployed)
  -> Email domain validation (@nyu.edu only)
  -> Firebase Auth state (onAuthStateChanged)
  -> App reads user.email, user.getIdToken()
```

### Key Components

| Component | File | Role |
|-----------|------|------|
| Firebase Client Config | `lib/firebase/firebaseClient.ts` | Firebase app init, Google Auth Provider, `signInWithGoogle()`, `getGoogleRedirectResult()` |
| Firebase Admin | `lib/firebase/server/firebaseAdmin.ts` | Server-side `admin.auth().verifyIdToken()` |
| AuthProvider | `components/src/client/routes/components/AuthProvider.tsx` | React context, `onAuthStateChanged` listener, `useAuth()` hook |
| GoogleSignIn | `components/src/client/routes/components/GoogleSignIn.tsx` | Sign-in UI component |
| Provider (Database) | `components/src/client/routes/components/Provider.tsx` | Extracts `userEmail`, derives `netId`, determines `pagePermission` |
| Entitlements API | `app/api/nyu/entitlements/[netId]/route.ts` | Server-side token verification via `admin.auth().verifyIdToken()` |
| Auth Callback | `app/api/auth/callback/route.ts` | Google OAuth code exchange (for Google API access, not user auth) |
| Google Client | `lib/googleClient.ts` | OAuth2 client for Google Calendar/Gmail/Sheets APIs (service-level, not user auth) |

### How User Identity Is Used

1. **Email** (`user.email`) - Primary identifier throughout the app
   - Role determination: checked against `usersSuperAdmin`, `usersRights`, `usersApprovers` collections
   - Booking ownership: `email` field on bookings
   - Action attribution: `firstApprovedBy`, `finalApprovedBy`, `checkedInBy`, etc.
   - Access control: email-based permission checks

2. **NetID** (derived as `email.split("@")[0]`)
   - NYU Identity API calls: `/api/nyu/identity/{netId}`
   - Tenant entitlement checks: `/api/nyu/entitlements/{netId}`
   - Walk-in identification

3. **Firebase ID Token** (`user.getIdToken()`)
   - Sent as `Authorization: Bearer <token>` to protected API routes
   - Verified server-side via `admin.auth().verifyIdToken()`
   - Only used in the entitlements API endpoint currently

4. **Firebase UID** (`user.uid`)
   - Not used for any data storage or queries (only referenced in test mocks)

### Auth Guards & Domain Validation

`@nyu.edu` email validation happens in **4 separate locations**:
- `firebaseClient.ts` line 121-123: `GoogleAuthProvider.setCustomParameters({ hd: "nyu.edu" })`
- `firebaseClient.ts` line 158, 188: Post-sign-in email domain check
- `AuthProvider.tsx` line 63: `onAuthStateChanged` handler
- `entitlements/route.ts` line 32: Server-side token verification

---

## 2. Target State

### Authentication Flow (NYU SSO via OIDC)

```
User clicks "Sign in with NYU"
  -> Redirect to NYU SSO (Shibboleth/OIDC)
  -> NYU authenticates user (NetID + password + Duo MFA)
  -> Redirect back to app with authorization code
  -> App exchanges code for ID token + access token
  -> App creates session (JWT in encrypted cookie)
  -> App reads user identity from OIDC claims
```

### What Changes

| Aspect | Current (Firebase Auth) | Target (NYU SSO) |
|--------|------------------------|-------------------|
| Sign-in UI | "Sign in with NYU Google Account" button | "Sign in with NYU" button |
| Auth provider | Google OAuth via Firebase | NYU Shibboleth via OIDC |
| Token format | Firebase ID Token (JWT) | OIDC ID Token (JWT) |
| Token verification | `admin.auth().verifyIdToken()` | NextAuth `getServerSession()` / `auth()` |
| Session management | Firebase client SDK (`onAuthStateChanged`) | NextAuth session (encrypted cookie) |
| Domain validation | Manual `@nyu.edu` check | Implicit (only NYU users can authenticate) |
| MFA | Google account MFA (if user has it) | NYU Duo MFA (enforced by NYU) |

### What Does NOT Change

- **User identity model**: Still email + netId based
- **Role/permission system**: Still Firestore collections (`usersRights`, `usersApprovers`, etc.)
- **Booking data model**: No changes to how bookings reference users
- **Google API access**: `lib/googleClient.ts` uses service account credentials, independent of user auth
- **Firestore database**: Continue using Firestore for data storage (Firebase Auth != Firestore)
- **Multi-tenancy**: `x-tenant` header system stays the same
- **NYU Identity API**: Continue using for user attributes (department, affiliation, etc.)

---

## 3. Impact Analysis

### Files That MUST Change

| File | Changes Required |
|------|-----------------|
| `lib/firebase/firebaseClient.ts` | Remove Google Auth Provider, `signInWithGoogle()`, `getGoogleRedirectResult()`. Keep Firebase app init (still need Firestore). |
| `components/src/client/routes/components/AuthProvider.tsx` | Replace `onAuthStateChanged` with NextAuth `useSession()`. Keep same `useAuth()` hook interface. |
| `components/src/client/routes/components/GoogleSignIn.tsx` | Replace with NYU SSO sign-in component using NextAuth `signIn()`. |
| `app/api/nyu/entitlements/[netId]/route.ts` | Replace `admin.auth().verifyIdToken()` with NextAuth `auth()` session check. |
| `app/page.tsx` | Remove `user.getIdToken()` call. Entitlements API uses session cookie automatically. |
| `app/layout.tsx` | Add NextAuth `SessionProvider` wrapper. |
| `next.config.mjs` | Remove `/__/auth` rewrite. Add OIDC env vars. |

### Files That MAY Change

| File | Reason |
|------|--------|
| `lib/firebase/server/firebaseAdmin.ts` | Remove `admin.auth()` usage if no longer needed (keep for Firestore admin). |
| `lib/firebase/stubs/firebaseAuthStub.ts` | Update or remove test stubs. |
| `tests/setup.ts` | Update test auth mocking. |

### Files That Do NOT Change

- `lib/googleClient.ts` - Service account auth for Google APIs (Calendar, Gmail, etc.)
- `components/src/utils/permissions.ts` - Permission logic (unchanged)
- `components/src/policy.ts` - Collection names (unchanged)
- `components/src/server/admin.ts` - Booking operations (unchanged)
- `lib/firebase/server/adminDb.ts` - Firestore operations (unchanged)
- `components/src/client/routes/components/Provider.tsx` - Works unchanged if `useAuth()` interface is preserved
- All Firestore data and collections

---

## 4. Migration Strategy

### Approach: NextAuth.js v5 (Auth.js) with Generic OIDC Provider

**Why NextAuth.js:**
- Built-in OIDC provider support
- First-class Next.js App Router support (v5)
- Session management (JWT-based, stateless) out of the box
- Middleware support for route protection
- Active maintenance and large community

**Session Model: JWT-based (stateless)**
- No additional database needed
- Session data stored in encrypted cookie
- Contains: `email`, `netId`, `name`
- Configurable expiry

---

## 5. Implementation Steps

### Step 1: Install NextAuth.js and Create Auth Config

**New files:**
- `lib/auth.ts` — NextAuth configuration with generic OIDC provider
- `app/api/auth/[...nextauth]/route.ts` — NextAuth API route handler
- `components/src/client/routes/components/SessionProvider.tsx` — Client-side session provider wrapper

**Configuration:**
```typescript
// lib/auth.ts
import NextAuth from "next-auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [{
    id: "nyu-sso",
    name: "NYU SSO",
    type: "oidc",
    issuer: process.env.OIDC_ISSUER,
    clientId: process.env.OIDC_CLIENT_ID,
    clientSecret: process.env.OIDC_CLIENT_SECRET,
  }],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, profile }) {
      if (profile?.email) {
        token.email = profile.email;
        token.netId = profile.email.split("@")[0];
      }
      return token;
    },
    session({ session, token }) {
      session.user.email = token.email;
      session.user.netId = token.netId;
      return session;
    },
  },
});
```

**Environment variables (already partially in `.env.local`):**
```
OIDC_ISSUER=<NYU SSO discovery URL>
OIDC_CLIENT_ID=<from NYU SSO team>
OIDC_CLIENT_SECRET=<from NYU SSO team>
AUTH_SECRET=<random secret for JWT encryption>
AUTH_URL=<app URL, e.g. http://localhost:3000>
```

---

### Step 2: Update Layout and Auth Provider

**Modify `app/layout.tsx`:**
- Wrap app with NextAuth `SessionProvider`

**Modify `components/src/client/routes/components/AuthProvider.tsx`:**
- Replace Firebase `onAuthStateChanged` with NextAuth `useSession()`
- Keep the same `useAuth()` hook interface so downstream consumers (`Provider.tsx`, `app/page.tsx`, etc.) don't need changes:
  ```typescript
  // Return shape stays the same:
  { user: { email, ... } | null, loading: boolean, error: string | null, isOnTestEnv: boolean }
  ```

---

### Step 3: Replace Sign-In Component

**Modify `components/src/client/routes/components/GoogleSignIn.tsx`** (rename to `SsoSignIn.tsx`):
- Replace Google sign-in with `signIn("nyu-sso")` from `next-auth/react`
- Button text: "Sign in with NYU"
- No popup vs redirect logic needed (always server-side redirect via NextAuth)
- Keep test environment handling

**Update imports in:**
- `app/signin/page.tsx`
- `app/[tenant]/signin/page.tsx`

---

### Step 4: Update Server-Side Auth

**Modify `app/api/nyu/entitlements/[netId]/route.ts`:**
- Replace `admin.auth().verifyIdToken()` with NextAuth `auth()` helper
- Extract email/netId from session instead of Firebase token
- Keep `shouldBypassAuth()` for test environments

**Modify `app/page.tsx`:**
- Remove `user.getIdToken()` call
- Entitlements API call uses session cookie (sent automatically by browser)
- Or use server component with `auth()` to get session directly

---

### Step 5: Clean Up Firebase Auth Code

**Modify `lib/firebase/firebaseClient.ts`:**
- Remove: `getAuth`, `GoogleAuthProvider`, `signInWithPopup`, `signInWithRedirect`, `getRedirectResult` imports
- Remove: `signInWithGoogle()`, `getGoogleRedirectResult()` functions
- Remove: `auth`, `googleProvider` exports
- Remove: `dynamicTestEnv`, `isTestEnv` auth-related logic, `isLocalhost` check
- Remove: All `@nyu.edu` domain validation (NYU SSO handles this implicitly)
- **Keep**: Firebase app init, Firestore init (`initializeDb`, `getDb`)

**Modify `next.config.mjs`:**
- Remove `/__/auth/:path*` rewrite rule (Firebase Auth redirect)
- Remove `firebase-admin/auth` from webpack alias exclusions (keep `firebase-admin/firestore`)

**Delete:**
- `components/src/client/routes/components/GoogleSignIn.tsx` (replaced by `SsoSignIn.tsx`)

**Update tests:**
- Update `tests/setup.ts` and auth stubs for new auth model

---

## 6. Risk Assessment

### High Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| NYU SSO downtime blocks all users | Users cannot access app | Graceful error page: "NYU SSO is currently unavailable". |
| Session/Firestore data mismatch | Users lose access to bookings | Email-based identity is preserved — NYU SSO returns same `@nyu.edu` email. No data migration needed. |

### Medium Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Google API access breaks | Calendar/Gmail integration fails | `lib/googleClient.ts` uses service account (refresh token), NOT user auth. Unaffected. Verify in staging. |
| Local development harder | Dev velocity decreases | Use NYU SSO QA server with `localhost:3000` redirect, or mock OIDC provider for local dev. |
| Session expiry UX | Unexpected sign-out | Configure session lifetime appropriately. Clear "session expired" messaging. |

### Low Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Firebase UID in existing data | Data integrity | System does NOT use Firebase UID for storage. All references are email-based. |
| Package conflicts | Build failure | NextAuth has minimal dependencies. Test in isolated branch. |

---

## 7. Open Questions

1. **SSO Credentials**: Noah has the Client ID / Client Secret from Michael Avallone (shared via Box Note). Need access to start implementation.

2. **Local Development**: Can `http://localhost:3000/api/auth/callback/nyu-sso` be added as a valid redirect URI on the QA server?

3. **Production Redirect URI**: When ready, what's the process for adding the production redirect URI?

4. **Rollout**: Big-bang switch or gradual rollout per tenant?

---

## Appendix: Architecture Diagrams

### Current Auth Flow
```
Browser                    Firebase Auth              Google OAuth
  |                            |                          |
  |-- signInWithGoogle() ----->|                          |
  |                            |-- OAuth redirect ------->|
  |                            |<-- auth code ------------|
  |                            |-- exchange for tokens -->|
  |<-- onAuthStateChanged -----|                          |
  |                            |                          |
  |-- getIdToken() ----------->|                          |
  |<-- Firebase JWT -----------|                          |
  |                            |                          |
  |-- API call (Bearer JWT) ---|--------> Next.js API ----|
  |                            |          verifyIdToken() |
  |                            |<-- decoded token --------|
```

### Target Auth Flow
```
Browser                    Next.js (NextAuth)         NYU SSO (OIDC)
  |                            |                          |
  |-- "Sign in with NYU" ----->|                          |
  |                            |-- OIDC authorize ------->|
  |                            |                          |-- NYU login + Duo MFA
  |                            |<-- auth code ------------|
  |                            |-- exchange for tokens -->|
  |                            |<-- ID token + access ----|
  |<-- Set session cookie -----|                          |
  |                            |                          |
  |-- API call (session) ----->|                          |
  |                            |-- getServerSession() --->|
  |                            |<-- session data ---------|
```

### File Change Map
```
CREATE:
  lib/auth.ts                                    NextAuth config
  app/api/auth/[...nextauth]/route.ts            NextAuth route handler
  components/.../SessionProvider.tsx              Client session wrapper

MODIFY:
  components/.../AuthProvider.tsx                 useSession() instead of onAuthStateChanged
  components/.../GoogleSignIn.tsx → SsoSignIn.tsx signIn("nyu-sso") instead of Firebase
  app/layout.tsx                                 Add SessionProvider
  app/page.tsx                                   Remove getIdToken()
  app/api/nyu/entitlements/[netId]/route.ts      auth() instead of verifyIdToken()
  app/signin/page.tsx                            Update import
  app/[tenant]/signin/page.tsx                   Update import
  lib/firebase/firebaseClient.ts                 Remove auth exports, keep Firestore
  next.config.mjs                                Remove auth rewrite, add env vars

NO CHANGE:
  lib/googleClient.ts                            Service account (independent)
  components/.../Provider.tsx                    useAuth() interface preserved
  components/.../permissions.ts                  Email-based (unchanged)
  lib/firebase/server/adminDb.ts                 Firestore ops (unchanged)
  components/src/server/admin.ts                 Booking ops (unchanged)
```
