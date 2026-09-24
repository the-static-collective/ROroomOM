# STEM-007 — Developmental Magic Widget (experimental integration plan)

**Implementation boundary:** This branch is based on `room-006-effectful-rejoin-bat`. The runnable ROOM-007 build was produced and tested as a separate local ZIP artifact in the originating ChatGPT conversation. This document records its integration contract; the ZIP source is **not yet committed on this branch** and this page is not an assertion that STEM-007 runs from GitHub.

## Executable specimen supplied with the ZIP

The Room 006 five-face block is extended with an independently addressable developmental graph. A human can awaken a root stem, self-renew to an independent stem, differentiate stem → scene → timeline, reprogram a specialized descendant into a new open seed, or compose two source cells into a new two-parent block. The Room's working drafts are checkpointed before division, and each child receives a bounded copy rather than a mutable reference to its parent's text.

## Required identity / authority constraints

- One unique Room object and one unique local developmental birth event per cell. Preserve parent IDs, parent revision pointers, and frozen bounded source material. No hidden rewrite of earlier events when a parent changes.
- Every child begins with `grants: []`. Identity, expressed UI face, and declared potential do not authorize execution; Room 005's prepare → inspect → explicit approval → execute → receipt boundary remains separate.
- Reprogramming creates a new descendant; it never erases specialized parent history. A two-parent composition preserves both ordered parents.
- Detect malformed imported developmental graphs, cycles, duplicate births, nonempty grants, and bounded-size violations; accept earlier Room v1–v3 snapshots without a stem graph.
- Local records are not externally authenticated project lineage. Media bytes remain transient and are not inherited through snapshot or exported developmental events.

## Acceptance test

Song → (optional second open stem) + scene → timeline → open seed; independently rewrite the scene and verify neither the song nor the previously born timeline changes. Compose two branches, export and reimport the Room snapshot, inspect the resulting ancestry, then reject a forged grant and cyclic parent pointer. Run inherited ROOM-005 capability tests without altering the server-side approval boundary.

**Status:** contract documented here. Full executable local ZIP has not been GitHub-staged yet; do not merge this branch as a completed integration.
