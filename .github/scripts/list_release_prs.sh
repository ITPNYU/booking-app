#!/usr/bin/env bash
# Print the numbers of the PRs bundled into a release.
#
# Usage: list_release_prs.sh <head-sha> <release-base-branch>
#
# The head SHA is the merge commit of a release PR (e.g. main -> staging). The
# script finds that release PR, walks its commits, and prints every merged PR
# whose commits are part of it (excluding other release PRs), followed by the
# release PR itself so that issues linked directly to it (hotfixes) count too.
# Numbers are printed one per line.
#
# Environment:
#   GH_TOKEN           Token that can read the repository.
#   GITHUB_REPOSITORY  owner/repo (set by GitHub Actions).
set -euo pipefail

HEAD_SHA="${1:?head sha is required}"
RELEASE_BASE="${2:?release base branch is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
OWNER="${GITHUB_REPOSITORY%%/*}"
NAME="${GITHUB_REPOSITORY##*/}"

RELEASE_PR=$(gh api "repos/${GITHUB_REPOSITORY}/commits/${HEAD_SHA}/pulls" \
  | jq -r --arg base "$RELEASE_BASE" \
    '[.[] | select(.base.ref == $base and .merged_at != null)] | sort_by(.merged_at) | last | .number // empty')
if [ -z "$RELEASE_PR" ]; then
  echo "No merged PR into ${RELEASE_BASE} found for ${HEAD_SHA}." >&2
  exit 0
fi
echo "Release PR #${RELEASE_PR} into ${RELEASE_BASE}" >&2

mapfile -t SHAS < <(gh api "repos/${GITHUB_REPOSITORY}/pulls/${RELEASE_PR}/commits" --paginate --jq '.[].sha')
echo "${#SHAS[@]} commits" >&2

# One GraphQL query per 50 commits; each commit is aliased so jq can flatten the result.
NUMBERS="[]"
for ((start = 0; start < ${#SHAS[@]}; start += 50)); do
  FIELDS=""
  for ((i = start; i < start + 50 && i < ${#SHAS[@]}; i++)); do
    FIELDS+="c${i}: object(oid: \"${SHAS[$i]}\") { ... on Commit { associatedPullRequests(first: 10) { nodes { number merged baseRefName } } } } "
  done
  CHUNK=$(gh api graphql -f query="query { repository(owner: \"${OWNER}\", name: \"${NAME}\") { ${FIELDS} } }" \
    | jq -c --arg base "$RELEASE_BASE" \
      '[.data.repository | to_entries[] | .value.associatedPullRequests.nodes[]
        | select(.merged and .baseRefName != $base) | .number]')
  NUMBERS=$(jq -n --argjson a "$NUMBERS" --argjson b "$CHUNK" '$a + $b')
done

jq -r --argjson release "$RELEASE_PR" '. + [$release] | unique | .[]' <<<"$NUMBERS"
