#!/usr/bin/env bash
#
# Provision Firestore composite indexes for a single environment database.
#
# Single source of truth: firestore.indexes.json (the Firebase-native index
# format). To add or change an index, edit that file only — the deploy
# workflows do not need to change.
#
# We drive `gcloud firestore indexes composite create` rather than
# `firebase deploy --only firestore:indexes` because firebase-tools 15.x
# throws a TypeError on the multi-database `firestore` array in firebase.json,
# masking real failures. gcloud must already be authenticated by the caller.
#
# Usage: deploy-firestore-indexes.sh <database> <project> [indexes-file]
#   <database>     Firestore database id (e.g. '(default)', 'booking-app-prod')
#   <project>      GCP project id
#   [indexes-file] defaults to firestore.indexes.json next to this script's dir
#
set -euo pipefail

DB="${1:?database id required}"
PROJECT="${2:?project id required}"
INDEXES_FILE="${3:-$(dirname "$0")/../firestore.indexes.json}"

command -v jq >/dev/null 2>&1 || { echo "jq is required but not installed" >&2; exit 1; }
[ -f "$INDEXES_FILE" ] || { echo "Indexes file not found: $INDEXES_FILE" >&2; exit 1; }

echo "Provisioning Firestore indexes from '$INDEXES_FILE' into database '$DB' (project $PROJECT)"

COUNT=$(jq '.indexes | length' "$INDEXES_FILE")
FAILED=0

for i in $(seq 0 $((COUNT - 1))); do
  CG=$(jq -r ".indexes[$i].collectionGroup" "$INDEXES_FILE")
  SCOPE=$(jq -r ".indexes[$i].queryScope // \"COLLECTION\"" "$INDEXES_FILE")

  ARGS=(--collection-group="$CG" --database="$DB" --project="$PROJECT")
  if [ "$SCOPE" = "COLLECTION_GROUP" ]; then
    ARGS+=(--query-scope=collection-group)
  fi

  # One --field-config per field: ordered fields use order=asc/desc, array
  # fields use array-config=contains.
  while IFS= read -r field; do
    path=$(jq -r '.fieldPath' <<<"$field")
    order=$(jq -r '.order // empty' <<<"$field")
    array=$(jq -r '.arrayConfig // empty' <<<"$field")
    if [ -n "$order" ]; then
      ord=$(echo "$order" | tr '[:upper:]' '[:lower:]')
      ARGS+=("--field-config=field-path=$path,order=$ord")
    elif [ -n "$array" ]; then
      ARGS+=("--field-config=field-path=$path,array-config=contains")
    else
      echo "  WARNING: field '$path' on $CG has neither order nor arrayConfig; skipping field" >&2
    fi
  done < <(jq -c ".indexes[$i].fields[]" "$INDEXES_FILE")

  echo "Ensuring composite index on $CG ($SCOPE) in $DB..."
  set +e
  OUTPUT=$(gcloud firestore indexes composite create "${ARGS[@]}" --quiet 2>&1)
  EXIT=$?
  set -e

  if [ $EXIT -ne 0 ]; then
    if echo "$OUTPUT" | grep -qi "ALREADY_EXISTS"; then
      echo "  already exists, skipping"
    else
      echo "  FAILED to create index for $CG:"
      echo "$OUTPUT"
      FAILED=1
    fi
  else
    echo "$OUTPUT"
  fi
done

if [ "$FAILED" -ne 0 ]; then
  echo "One or more indexes failed to create." >&2
  exit 1
fi

echo "All Firestore indexes ensured for database '$DB'."
