# Orphan constellation — recovery index (2026-09-24)

**STATUS: INCOMPLETE SOURCE TRANSFER. Do not delete source ZIPs yet.** This branch is an experimental landing index, not a claim that archive bytes are stored in GitHub. The attached ZIP files in the originating ChatGPT conversation were inspected, but the GitHub connector cannot directly ingest their binary file references. Original attachments must be retained until file-byte transfer is independently verified.

## Five uploaded archives

| Archive | ZIP bytes | Contents |
| --- | ---: | --- |
| orphan-constellation-20260924.zip | 733356 | 56 entries, source overlay of ROOM 006–008, Lemon Press 001–003, Address Loom 001, tests, README, manifest and two PNG screenshots |
| lemon-press-living-artifact-001.zip | 15281 | initial Lemon Press edition |
| lemon-press-living-artifact-002-1.zip | 23129 | relation grammar edition |
| address-loom-playsmash-001.zip | 17833 | independent Address Loom browser experiment |
| lemon-press-living-artifact-003.zip | 31082 | current local Inventorama edition |

The first archive includes the unpacked *contents* of the other four, but not their original ZIP bytes. Its own `SOURCE-RECEIPT.json` lists SHA-256 checksums for the four edition archives as well as an earlier ROOM 006–008 ZIP; those are not checksums of this newly uploaded constellation ZIP. The earlier ROOM 006–008 ZIP is not included among the five uploads in this turn.

## Proposed homes

- `room-006-008/repo-overlay/`: integrate additively into [ROroomOM draft PR #4](https://github.com/the-static-collective/ROroomOM/pull/4) only after checking exact parent and re-running tests.
- `lemon-press/edition-001/`, `slice-002/`, `slice-003/`: keep all three editions independently; do not silently substitute current runtime for past editions.
- `address-loom/playsmash-001/`: independent experimental source.
- `HANDOFF-CONTRACT.md`: proposed adapter; **no cross-runtime transfer implemented**.

## Recovery constraints

Retain the five ChatGPT attachments or another verified copy until exact ZIP byte contents have been transferred. This record is an index and a reminder, not a backup of binaries. Do not merge experimental branch into main as a runnable implementation.