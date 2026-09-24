# ROOM 006–008 orphan recomposition — integration receipt

Status: **source overlay tested locally, not yet committed to this GitHub branch.** This record preserves the exact integration target and transport fingerprints; it does not claim that the ZIP's executable code has been uploaded to GitHub.

## Verified starting point
- Parent branch: `room-007-stem-cell-development`
- Parent commit: `fcbfee9f0b2b6b188de9b456280b62cafca4bb71`
- Preserve `experiments/rejoining_room_006/` (the separate effectful WORLDSEED rejoin experiment), `compose005.py`, and all original ROOM 005 server/bridge files. ROOM 006's five-face creative widget and the separate ROOM 006 rejoin experiment are distinct works.

## Supplied archive fingerprints
- ROroomOM-006-1.zip: SHA-256 `7160ad7c320b240bbe5595e225bd04f14be82ae18d22c6436804e742bbb461c3` (87128 bytes)
- ROroomOM-007.zip: SHA-256 `3e850cb06847f5ef0e5c0626981091a55cc9feece3456c4b03cadc6b4d367ca1` (1980747 bytes)
- ROroomOM-008.zip: SHA-256 `604ca2a8e1115c711c022833c9b62be73a787be4f8a5133bfb7397f680072e95` (623069 bytes)
- Locally generated ROroomOM-006-008-recomposed.zip: SHA-256 `deea5e9d270ce00bbf1590c1ae72d4a4f5a90acd0b2c31543ea10d4d027072a8` (166183 bytes), attached in the originating ChatGPT conversation, **not available as a GitHub-hosted artifact**.

## Source reconciliation
ROOM 008 includes identical 006 magic-block and 007 stem007 engines and adds experience008 layout/video-still composition. The 008 transport ZIP omits `test_magic_block006.js`; the recomposition restores it verbatim from 007 and saves the original READMEs individually. The standalone package also includes unchanged inherited ROOM 005 bridge/source/test files so its deterministic composition can run without a separate Git checkout. The package is an additive overlay on the checked parent branch, never a replacement tree.

## Local checks observed before GitHub transfer
- `node test_magic_block006.js`: pass.
- `node test_stem007.js`: pass.
- `python3 test_browser007.py`: pass (no browser JavaScript errors).
- `python3 test_experience008.py`: pass (video still → UI, play, portable export, score branch, snapshot reentry, mobile image import; no browser errors).
- `python3 -m unittest discover -s . -p test_capability005.py -v`: six passed using the test's fake Workbench; not evidence of real Workbench integration.
- `python3 compose008.py`: byte-identical 146208-byte `static-room.html`.

The final exported bundle was re-extracted and verified: 27 source-file SHA-256s match its manifest; the 146208-byte standalone page rebuilt byte-identically; the packaged 006 and 007 Node suites passed. An earlier incomplete candidate bundle was replaced and must not be used.\n\n## Landing gate
Copy the tested overlay into this integration branch after verifying its hashes and the existing tracked files. Do not delete the rejoining ROOM 006 experiment. Run all suites again on the actual integrated GitHub checkout; open/review the draft PR before merging. No new project write authority, authenticated lineage, STATIC OS installation, or ROOM 009 recursive runtime is claimed.

ROOM 009's proposed law: a block can project as an inhabitable workspace, which may contain placements of other blocks/workspaces. Identity and development, containment, projection, and declared relation are distinct edges. Containment does not grant authority.