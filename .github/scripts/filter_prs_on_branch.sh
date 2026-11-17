#!/usr/bin/env bash
# Print the given PR numbers whose merge commit is on a branch.
#
# Usage: filter_prs_on_branch.sh <branch> <pr-number>...
#
# Used by the prod release to keep only the PRs that have also been released to
# staging. A PR counts as being on the branch when its merge commit is an
# ancestor of the branch tip, so release PRs must be merged with a merge commit
# (a squash would drop the ancestry). PRs that are not on the branch are
# reported as workflow warnings on stderr. Numbers are printed one per line.
#
# Environment:
#   GH_TOKEN           Token that can read the repository.
#   GITHUB_REPOSITORY  owner/repo (set by GitHub Actions).
set -euo pipefail

BRANCH="${1:?branch is required}"
shift
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

for PR in "$@"; do
  SHA=$(gh api "repos/${GITHUB_REPOSITORY}/pulls/${PR}" --jq '.merge_commit_sha // empty')
  if [ -z "$SHA" ]; then
    echo "::warning::PR #${PR} has no merge commit; its issues were left alone." >&2
    continue
  fi
  # compare base...head: "ahead" or "identical" means base is an ancestor of head.
  STATUS=$(gh api "repos/${GITHUB_REPOSITORY}/compare/${SHA}...${BRANCH}" --jq '.status')
  if [ "$STATUS" = "ahead" ] || [ "$STATUS" = "identical" ]; then
    echo "$PR"
  else
    echo "::warning::PR #${PR} is not on ${BRANCH}; its issues were left alone." >&2
  fi
done
