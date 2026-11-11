#!/usr/bin/env bash
# Print the issues linked (via "Development" / closing references) to the given PRs
# as a JSON array of {number, title, url}, unique and sorted by number.
#
# Usage: list_release_issues.sh <pr-number>...
#
# Environment:
#   GH_TOKEN           Token that can read the repository.
#   GITHUB_REPOSITORY  owner/repo (set by GitHub Actions).
set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
OWNER="${GITHUB_REPOSITORY%%/*}"
NAME="${GITHUB_REPOSITORY##*/}"

# Accept the numbers as separate arguments or as one space-separated argument.
# shellcheck disable=SC2048,SC2086
set -- $*
if [ "$#" -eq 0 ]; then
  echo "[]"
  exit 0
fi

# One GraphQL query per 50 PRs; each PR is aliased so jq can flatten the result.
ISSUES="[]"
ARGS=("$@")
for ((start = 0; start < ${#ARGS[@]}; start += 50)); do
  FIELDS=""
  for ((i = start; i < start + 50 && i < ${#ARGS[@]}; i++)); do
    FIELDS+="p${i}: pullRequest(number: ${ARGS[$i]}) { closingIssuesReferences(first: 20) { nodes { number title url } } } "
  done
  CHUNK=$(gh api graphql -f query="query { repository(owner: \"${OWNER}\", name: \"${NAME}\") { ${FIELDS} } }" \
    | jq -c '[.data.repository | to_entries[] | .value.closingIssuesReferences.nodes[]]')
  ISSUES=$(jq -n --argjson a "$ISSUES" --argjson b "$CHUNK" '$a + $b')
done

jq -c 'unique_by(.number) | sort_by(.number)' <<<"$ISSUES"
