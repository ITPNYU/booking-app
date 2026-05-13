# Copilot Review Instructions

## Screenshot / Video requirement

When a pull request includes changes to UI-related files (e.g., `.tsx`, `.css`, `.scss`, or files under `components/`, `routes/`, `pages/`), check whether the PR description contains screenshots or videos demonstrating the change.

Look for evidence such as:
- Image embeds (`![...](...)` or `<img` tags)
- Video embeds (`<video` tags)
- Links to image/video hosting services (e.g., GitHub user-content URLs, Loom, YouTube)
- Uploaded file attachments in the "Screenshots / Video" section

If UI-related files are changed and no screenshots or videos are found in the PR description, leave a comment requesting the author to attach screenshots or a video demonstrating the UI changes, as required by the PR checklist.

## Firestore composite index requirement

Firestore rejects any query that needs a composite index when the index is missing — it fails with `FAILED_PRECONDITION` at runtime, not "runs slowly". Composite indexes for this repo are declared in `booking-app/firestore.indexes.json` and deployed by the `firebase deploy --only firestore:indexes` step in each App Engine deploy workflow.

When a pull request introduces or modifies a Firestore query (`firebase-admin` `db.collection(...).where(...)` chains, or the equivalent client SDK queries) that requires a composite index, check whether `booking-app/firestore.indexes.json` has been updated to declare the matching index.

A query needs a composite index when it combines any of the following on a single collection:

- Two or more `.where(...)` clauses on different fields
- A `.where(...)` plus a `.orderBy(...)` on a different field
- A `.where(field, "in", [...])` or `array-contains-any` combined with another `.where(...)`
- A `.where(field, <inequality>, ...)` (`<`, `<=`, `>`, `>=`, `!=`) plus a `.orderBy(...)` on a different field

Equality on a single field, or an `orderBy` on the same field as a `where`, does not need a composite index — single-field indexes are auto-managed by Firestore.

Watch for the tenant-prefixed collection naming pattern in this repo: `getTenantCollectionName("bookingLogs", "mc")` resolves to the `mc-bookingLogs` collection. The composite index in `firestore.indexes.json` must use the resolved collection name (e.g. `"collectionGroup": "mc-bookingLogs"`), and one entry is typically needed per tenant.

If a PR adds or changes a Firestore compound query and `booking-app/firestore.indexes.json` is not updated accordingly, leave a comment asking the author to declare the required composite index(es) in that file so the existing deploy workflow can create them.
