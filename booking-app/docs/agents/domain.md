# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This is a single-context repo. The glossary lives at the git root; the app, and the ADRs with it, live in the `booking-app/` directory — paths below are relative to the git root.

## Before exploring, read these

- **`CONTEXT.md`** at the git root — the domain glossary.
- **`booking-app/docs/adr/`** — read ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

```
/                                      ← git root
├── AGENTS.md                          ← agent instructions (CLAUDE.md imports it)
├── CONTEXT.md
└── booking-app/
    ├── docs/
    │   ├── adr/
    │   │   └── 0001-edit-resets-only-changed-service-decisions.md
    │   └── agents/                    ← issue-tracker.md, triage-labels.md, this file
    ├── app/
    ├── components/
    └── lib/
```

New ADRs go in `booking-app/docs/adr/`, numbered sequentially. Do not create a `docs/adr/` at the git root, or a second `CONTEXT.md` under `booking-app/`.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0001 (edit resets only changed service decisions) — but worth reopening because…_
