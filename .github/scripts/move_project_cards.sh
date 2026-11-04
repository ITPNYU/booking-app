#!/usr/bin/env bash
# Move the project cards of the issues linked to the given PRs to a status.
#
# Usage: move_project_cards.sh <pr-number>...
#
# Environment:
#   GH_TOKEN         Token with write access to the organization project
#                    (GITHUB_TOKEN cannot see organization projects).
#   GITHUB_REPOSITORY  owner/repo of the PRs (set by GitHub Actions).
#   PROJECT_OWNER    Organization that owns the project.
#   PROJECT_NUMBER   Project number as shown in its URL.
#   TARGET_STATUS    Name of the Status option to set, e.g. "Test - Dev".
#   DRY_RUN          Set to 1 to print the moves without applying them.
#
# Issues are found through the PR's Development links (closingIssuesReferences).
# Issues that are not on the project are skipped. Issues already in the target
# status are left alone.
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "No PR numbers given; nothing to do."
  exit 0
fi
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${PROJECT_OWNER:?PROJECT_OWNER is required}"
: "${PROJECT_NUMBER:?PROJECT_NUMBER is required}"
: "${TARGET_STATUS:?TARGET_STATUS is required}"
DRY_RUN="${DRY_RUN:-0}"

REPO_OWNER="${GITHUB_REPOSITORY%%/*}"
REPO_NAME="${GITHUB_REPOSITORY##*/}"

# Resolve the project, its Status field and the target option once.
PROJECT=$(gh api graphql \
  -f query='query($owner: String!, $number: Int!) {
    organization(login: $owner) {
      projectV2(number: $number) {
        id
        title
        field(name: "Status") {
          ... on ProjectV2SingleSelectField { id options { id name } }
        }
      }
    }
  }' -f owner="$PROJECT_OWNER" -F number="$PROJECT_NUMBER" --jq '.data.organization.projectV2')
PROJECT_ID=$(jq -r '.id' <<<"$PROJECT")
FIELD_ID=$(jq -r '.field.id' <<<"$PROJECT")
OPTION_ID=$(jq -r --arg s "$TARGET_STATUS" '.field.options[] | select(.name == $s) | .id' <<<"$PROJECT")
if [ -z "$OPTION_ID" ]; then
  echo "Error: project '$(jq -r .title <<<"$PROJECT")' has no Status option named '${TARGET_STATUS}'."
  jq -r '.field.options[].name' <<<"$PROJECT" | sed 's/^/  - /'
  exit 1
fi
echo "Project: $(jq -r .title <<<"$PROJECT") (#${PROJECT_NUMBER}), target status: ${TARGET_STATUS}"

MOVED=0
for PR in "$@"; do
  ISSUES=$(gh api graphql \
    -f query='query($owner: String!, $name: String!, $pr: Int!) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $pr) {
          closingIssuesReferences(first: 20) {
            nodes {
              number
              projectItems(first: 20) {
                nodes {
                  id
                  project { id }
                  fieldValueByName(name: "Status") {
                    ... on ProjectV2ItemFieldSingleSelectValue { name }
                  }
                }
              }
            }
          }
        }
      }
    }' -f owner="$REPO_OWNER" -f name="$REPO_NAME" -F pr="$PR" \
    --jq '.data.repository.pullRequest.closingIssuesReferences.nodes[]')

  if [ -z "$ISSUES" ]; then
    echo "PR #${PR}: no linked issues."
    continue
  fi

  while read -r issue; do
    NUMBER=$(jq -r '.number' <<<"$issue")
    ITEM=$(jq -c --arg p "$PROJECT_ID" '.projectItems.nodes[] | select(.project.id == $p)' <<<"$issue" | head -n 1)
    if [ -z "$ITEM" ]; then
      echo "PR #${PR}: issue #${NUMBER} is not on the project; skipped."
      continue
    fi
    ITEM_ID=$(jq -r '.id' <<<"$ITEM")
    CURRENT=$(jq -r '.fieldValueByName.name // "(none)"' <<<"$ITEM")
    if [ "$CURRENT" = "$TARGET_STATUS" ]; then
      echo "PR #${PR}: issue #${NUMBER} is already in '${TARGET_STATUS}'."
      continue
    fi
    if [ "$DRY_RUN" = "1" ]; then
      echo "PR #${PR}: would move issue #${NUMBER} from '${CURRENT}' to '${TARGET_STATUS}' (dry run)."
      continue
    fi
    gh api graphql \
      -f query='mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $project, itemId: $item, fieldId: $field,
          value: { singleSelectOptionId: $option }
        }) { projectV2Item { id } }
      }' -f project="$PROJECT_ID" -f item="$ITEM_ID" -f field="$FIELD_ID" -f option="$OPTION_ID" > /dev/null
    echo "PR #${PR}: moved issue #${NUMBER} from '${CURRENT}' to '${TARGET_STATUS}'."
    MOVED=$((MOVED + 1))
  done < <(jq -c '.' <<<"$ISSUES")
done
echo "Moved ${MOVED} card(s)."
