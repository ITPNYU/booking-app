#!/usr/bin/env bash
# Print the PRs that are merged to main but not yet released to prod, as a JSON
# array of {number, title, url, author, mergedAt} sorted by merge time.
#
# Usage: list_unreleased_prs.sh [exclude-label]...
#
# Releases are PRs merged into prod (main -> prod release PRs and hotfixes) and
# are squash-merged, so git history cannot tell what is on prod. Instead, every
# PR merged into prod in the last DAYS days is expanded into the PRs its commits
# came from; a PR merged to main in that window is "released" when it appears
# in one of them. PRs opened by bots, PRs with any of the given labels, and PRs
# not merged into main are left out.
#
# Environment:
#   GH_TOKEN           Token that can read the repository.
#   GITHUB_REPOSITORY  owner/repo (set by GitHub Actions).
#   DAYS               Window for both main merges and prod releases (default 60).
set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
DAYS="${DAYS:-60}"
OWNER="${GITHUB_REPOSITORY%%/*}"
NAME="${GITHUB_REPOSITORY##*/}"
EXCLUDE=$(printf '%s\n' "$@" | jq -R . | jq -s .)
SINCE=$(date -u -d "${DAYS} days ago" +%Y-%m-%d 2>/dev/null || date -u -v-"${DAYS}"d +%Y-%m-%d)

# Candidates: PRs merged to main in the window.
CANDIDATES=$(gh pr list --repo "$GITHUB_REPOSITORY" --state merged --base main --limit 200 \
  --search "merged:>=${SINCE}" --json number,title,url,author,mergedAt,labels \
  | jq --argjson exclude "$EXCLUDE" '
    [ .[]
      | select(.author.is_bot | not)
      | select(([.labels[].name] | map(. as $l | $exclude | index($l)) | any) | not)
      | {number, title, url, author: .author.login, mergedAt}
    ]')

# Released: PRs whose commits are part of a PR merged into prod in the window.
RELEASED="[]"
for RELEASE_PR in $(gh pr list --repo "$GITHUB_REPOSITORY" --state merged --base prod --limit 50 \
    --search "merged:>=${SINCE}" --json number --jq '.[].number'); do
  mapfile -t SHAS < <(gh api "repos/${GITHUB_REPOSITORY}/pulls/${RELEASE_PR}/commits" --paginate --jq '.[].sha')
  echo "Release PR #${RELEASE_PR}: ${#SHAS[@]} commits" >&2
  for ((start = 0; start < ${#SHAS[@]}; start += 50)); do
    FIELDS=""
    for ((i = start; i < start + 50 && i < ${#SHAS[@]}; i++)); do
      FIELDS+="c${i}: object(oid: \"${SHAS[$i]}\") { ... on Commit { associatedPullRequests(first: 10) { nodes { number } } } } "
    done
    CHUNK=$(gh api graphql -f query="query { repository(owner: \"${OWNER}\", name: \"${NAME}\") { ${FIELDS} } }" \
      | jq -c '[.data.repository | to_entries[] | .value.associatedPullRequests.nodes[].number]')
    RELEASED=$(jq -n --argjson a "$RELEASED" --argjson b "$CHUNK" '$a + $b | unique')
  done
done

jq --argjson released "$RELEASED" '
  [ .[] | select(.number as $n | $released | index($n) | not) ] | sort_by(.mergedAt)' <<<"$CANDIDATES"
