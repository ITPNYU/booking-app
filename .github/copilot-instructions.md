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

Firestore rejects any query that needs a composite index when the index is missing — it fails with `FAILED_PRECONDITION` at runtime, not "runs slowly".

Composite indexes for this repo are deployed by hard-coded `gcloud firestore indexes composite create` calls in the `Deploy Firestore indexes` step of `.github/workflows/deploy_development_app_engine.yml`, `deploy_staging_app_engine.yml`, and `deploy_production_app_engine.yml`. `booking-app/firestore.indexes.json` exists as a declarative source of truth but is **not consumed by the deploy workflows** (firebase-tools 15.x crashes on the multi-database `firebase.json` config, so the workflows switched to `gcloud` in e1c6c6f2 and now create indexes by name). To actually deploy a new composite index, the `create_index` calls in all three workflow files must be updated.

When a pull request introduces or modifies a Firestore query (`firebase-admin` `db.collection(...).where(...)` chains, or the equivalent client SDK queries) that requires a composite index, check whether both:

1. `booking-app/firestore.indexes.json` declares the matching index (for documentation / future re-enablement of `firebase deploy`), AND
2. The `Deploy Firestore indexes` step in **all three** App Engine deploy workflows has a matching `create_index` call.

A query needs a composite index when it combines any of the following on a single collection:

- A `.where(field, "in", [...])` (or `not-in` / `array-contains-any`) combined with another `.where(...)` on a different field
- A `.where(field, <op>, ...)` plus a `.orderBy(...)` on a different field (where `<op>` is anything other than `==` on the same field as the `orderBy`)
- A range / inequality `.where(...)` (`<`, `<=`, `>`, `>=`, `!=`) combined with another `.where(...)` on a different field
- A range / inequality plus an `.orderBy(...)` on a different field

Multiple equality (`==`) filters on different fields do **not** require a composite index — Firestore serves these by intersecting the auto-created single-field indexes. Plain equality on a single field, or an `orderBy` on the same field as a single `where`, also doesn't need a composite index.

Watch for the tenant-prefixed collection naming pattern in this repo: `getTenantCollectionName("bookingLogs", "mc")` resolves to the `mc-bookingLogs` collection. The composite index entries must use the resolved collection name (e.g. `mc-bookingLogs`), and one `create_index` call is typically needed per tenant.

If a PR adds or changes a Firestore query that needs a composite index and either `booking-app/firestore.indexes.json` or the deploy workflows are not updated to match, leave a comment asking the author to add the declaration to both places so the index is actually created at deploy time.
