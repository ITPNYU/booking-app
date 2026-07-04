#!/usr/bin/env python3
"""Submit the Claude review payload as one PR review, resilient to inline
comments GitHub cannot anchor to the diff.

The model writes ``/tmp/review.json`` with inline comments keyed to new-file
line numbers. GitHub's create-review API rejects the WHOLE review (HTTP 422,
"Line could not be resolved") if any single comment's line falls outside the
PR's diff hunks. To stay green without dropping findings, this script:

  1. Computes the set of commentable RIGHT-side lines from ``gh pr diff``.
  2. Keeps inline comments whose (path, line) is anchorable; folds the rest
     into the review body so the finding still shows up.
  3. POSTs once. On any residual failure, retries body-only, then gives up
     gracefully -- a review-infra hiccup must not block the PR.

Trust boundary: this is the trusted step. The endpoint is hardcoded here and
the model never holds ``gh api``; a malicious diff can only influence comment
*text* (which already lands in the review body either way), never which API
call runs.
"""
from __future__ import annotations

import json
import os
import re
import subprocess

REVIEW_PATH = "/tmp/review.json"


def parse_commentable_lines(diff: str) -> dict[str, set[int]]:
    """Map new-file path -> set of RIGHT-side line numbers inside diff hunks.

    GitHub allows a RIGHT-side comment on added (``+``) and context (`` ``)
    lines within a hunk; removed (``-``) lines have no new-file line. Pure
    function over unified-diff text so it can be unit-tested without network.
    """
    valid: dict[str, set[int]] = {}
    path: str | None = None
    newln = 0
    in_hunk = False
    for line in diff.splitlines():
        # A new file section resets state so inter-file metadata
        # (``diff --git``, ``index``, ``--- ``/``+++ `` headers) is never
        # mistaken for hunk content.
        if line.startswith("diff --git"):
            path, in_hunk = None, False
            continue
        if not in_hunk:
            if line.startswith("+++ "):
                p = line[4:].strip()
                if p.startswith("b/"):
                    p = p[2:]
                path = None if p == "/dev/null" else p
                if path is not None:
                    valid.setdefault(path, set())
            elif line.startswith("@@"):
                m = re.search(r"\+(\d+)", line)
                newln = int(m.group(1)) if m else 0
                in_hunk = True
            continue
        # Inside a hunk.
        if line.startswith("@@"):  # next hunk of the same file
            m = re.search(r"\+(\d+)", line)
            newln = int(m.group(1)) if m else 0
            continue
        if path is None:
            continue
        if line.startswith("+"):  # added line (commentable on RIGHT)
            valid[path].add(newln)
            newln += 1
        elif line.startswith(" "):  # context line (commentable on RIGHT)
            valid[path].add(newln)
            newln += 1
        # ``-`` (removed, no RIGHT line) and ``\`` ("No newline") consume nothing.
    return valid


def post(repo: str, pr: str, payload: dict) -> tuple[int, str]:
    proc = subprocess.run(
        ["gh", "api", "--method", "POST",
         f"/repos/{repo}/pulls/{pr}/reviews", "--input", "-"],
        input=json.dumps(payload), capture_output=True, text=True,
    )
    return proc.returncode, (proc.stdout + proc.stderr).strip()


def partition_comments(
    comments: list[dict], valid: dict[str, set[int]]
) -> tuple[list[dict], list[dict]]:
    """Split comments into (anchorable-inline, must-fold-into-body).

    A comment is anchorable when it targets the RIGHT side and both its
    ``line`` and (for a multi-line span) ``start_line`` land on a commentable
    line of the file in the diff.
    """
    kept, folded = [], []
    for c in comments:
        p, ln, sl = c.get("path"), c.get("line"), c.get("start_line")
        anchorable = (
            c.get("side", "RIGHT") == "RIGHT"
            and p in valid and ln in valid[p]
            and (sl is None or sl in valid[p])
        )
        (kept if anchorable else folded).append(c)
    return kept, folded


def _loc(c: dict) -> str:
    return f"{c.get('path')}:{c.get('line')}"


def main() -> None:
    pr = os.environ["PR_NUMBER"]
    repo = os.environ["REPO"]
    # The model occasionally writes a /tmp/review.json that isn't valid JSON
    # (e.g. an unescaped quote or newline inside a comment body), which made
    # ``json.load`` raise and fail the whole job. Review posting is advisory
    # and must not block the PR -- mirror the graceful give-up the submit
    # fallbacks already use: log loudly and return. Re-running the review
    # regenerates the file.
    try:
        with open(REVIEW_PATH) as f:
            review = json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        print(
            f"warning: could not read/parse {REVIEW_PATH} ({exc}); "
            "skipping review submit, not blocking the PR."
        )
        return
    if not isinstance(review, dict):
        print(
            f"warning: {REVIEW_PATH} is not a JSON object "
            f"(got {type(review).__name__}); skipping review submit, "
            "not blocking the PR."
        )
        return
    comments = review.get("comments") or []
    body = review.get("body") or ""
    base = {"event": review.get("event", "COMMENT")}
    if review.get("commit_id"):
        base["commit_id"] = review["commit_id"]

    valid: dict[str, set[int]] = {}
    try:
        diff = subprocess.run(
            ["gh", "pr", "diff", pr], capture_output=True, text=True, check=True
        ).stdout
        valid = parse_commentable_lines(diff)
    except Exception as exc:  # diff fetch/parse failed -> fall back to body-only
        print(f"warning: could not compute diff lines ({exc}); folding all inline comments")

    kept, folded = partition_comments(comments, valid)

    def fold_into(text: str, items: list[dict], heading: str) -> str:
        if not items:
            return text
        out = text + f"\n\n---\n**{heading}:**\n"
        for c in items:
            out += f"\n- `{_loc(c)}` -- {c.get('body', '').strip()}"
        return out

    # Attempt 1: anchorable comments inline, the rest folded into the body.
    body1 = fold_into(body, folded, "Findings that could not be anchored to the diff")
    rc, out = post(repo, pr, {**base, "body": body1, "comments": kept})
    if rc == 0:
        print(f"Posted review: {len(kept)} inline, {len(folded)} folded into body.")
        return
    print(f"Inline submit failed (rc={rc}); falling back to body-only.\n{out}")

    # Attempt 2: everything in the body, no inline anchors at all.
    body2 = fold_into(body1, kept, "Inline findings (anchoring unavailable)")
    rc, out = post(repo, pr, {**base, "body": body2 or "Review produced no anchorable findings.",
                              "comments": []})
    if rc == 0:
        print("Posted body-only review.")
        return

    # A body-only COMMENT review needs no line resolution, so this is an
    # auth/rate-limit/transport problem, not the 422 we set out to fix.
    # Log loudly but do not fail the job: review posting is advisory and must
    # not block the PR.
    print(f"warning: review submit failed entirely (rc={rc}); not blocking the PR.\n{out}")


if __name__ == "__main__":
    main()
