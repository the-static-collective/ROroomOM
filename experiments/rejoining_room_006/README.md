# ROroomOM-006 — Effectful Rejoining Room / interruption BAT

> Experimental, isolated, local-only specimen on \`room-006-effectful-rejoin-bat\`.
> No new browser route, capability descriptor, automatic WORLDSEED admission,
> remote host, project-native mutation, authenticated witness, or HOUSE authority.

## Source and destination

The source is **WORLDSEED-004's independently pinned, source-verified JointNode**. Its two branches remain separately witnessed and unchanged. The Room consumes only a \`JointAnchor\` derived from \`verify_joint()\`; the Room does *not* attempt to merge the two logs into one linear history. \`JointAnchor\` does not itself prove authenticity. Call \`worldseed004_adapter.load_verified_anchor()\` with independently obtained root, A, B and joint seals and the trusted root ID. Do not take pins from the same untrusted package being verified.

The destination is a single **Room-owned create-only Markdown artifact**, not a WORLDSEED or Static Workbench write. A new Room-local receipt references both historical parent states and seals, the joint ID and seal, the effect digest, the preserved tension, unresolved material, and three return addresses (A, B and joint). Historical source data is not edited or promoted to one supposedly original narrative.

## Executable experiment

Python 3.11+ standard library only, from the repository checkout:

\`\`\`bash
python3 -m unittest discover -s experiments/rejoining_room_006 -p 'test_engine.py' -v
\`\`\`

The specimen can be driven from Python after a trusted local caller **separately verifies** WORLDSEED-004's bundles:

\`\`\`python
from pathlib import Path
from engine import RejoiningRoom
from worldseed004_adapter import load_verified_anchor

anchor = load_verified_anchor(
    Path('/path/to/verified-worldseed004-home'),
    root_seal=TRUSTED_ROOT_SHA256,
    a_seal=TRUSTED_A_SHA256,
    b_seal=TRUSTED_B_SHA256,
    joint_seal=TRUSTED_JOINT_SHA256,
    root_state_id=TRUSTED_ROOT_STATE_ID,
)
room = RejoiningRoom(Path('/path/to/new/local-room-006-state'), anchor)
preview = room.prepare('One Room-owned, jointly inspired consequence.')
# Independently inspect the complete preview, then explicitly admit it locally.
result = room.commit(
    preview, approved_candidate_id=preview['candidate_id'],
    local_actor='local-test-operator',  # NOT authenticated identity
)
print(result)
room.close()
\`\`\`

\`engine.py\` and \`worldseed004_adapter.py\` are in the experiment directory; place it on your Python import path for the snippet. The optional adapter needs the separately installed, unmodified WORLDSEED-004 specimen. Do not use this stand-alone engine with arbitrary client-provided JointAnchor values as a verified import service.

## State machine / kill points

\`\`\`text
WORLDSEED-004 verified A ─┐
                          ├── verified joint ── Room-local exact preview
WORLDSEED-004 verified B ─┘                           │
                                           explicit local cut
                                                     │
                                            durable SQLite intent
                                                     │
                                            create-only artifact
                                                     │
                                          inspect/reconcile receipt
                                                     │
                                    Room descendant + A/B/joint returns
\`\`\`

- \`after_intent\`: kill process after SQLite intent commit, before artifact publication. Restart reports **accepted-needs-explicit-reconcile**. No automatic re-execution.
- \`after_artifact\`: kill process after atomic create-only file publication, before receipt commit. Restart checks exact bytes and finishes the one receipt without recreating the file.
- \`after_receipt\`: kill process after completed receipt commits. Restart reopens the same effect and receipt.
- A missing/modified completed file, substituted joint anchor, collapsed parents, tampered preview, unknown crossing, or wrong approval must refuse.
- A repeated committed crossing must not create a second artifact. A *different* explicitly previewed effect may create a different descendant; the test does not grant exclusive global succession.

\`crash_at\` and \`os._exit()\` are **BAT-only hooks**; never wire untrusted input to them.

## Test receipt

The 15 standalone BATs passed in the local specimen, including three real child-process deaths and separate-process re-entry. A separate integration pass ran the existing WORLDSEED-004 three-process demo, independently replayed the root and both branch seeds, called its \`verify_joint()\`, then created a single Room effect from that verified joint. The branch mirrors the exact tested engine and standalone tests. Full repository CI and actual browser/bridge integration have **not** been claimed.

## What is not solved

- Two local witness labels in WORLDSEED-004 and the new local operator label are **not authenticated signatures or verified human consent**. No imported label authorizes Room execution.
- The source package and independent SHA-256 pins are integrity inputs, not cryptographic source authentication or guaranteed recency.
- SQLite/full fsync plus create-only hard link is tested against process death, not power-loss consistency, malicious same-user filesystem changes, hostile multi-process contention, filesystem without hard-link support, or a network filesystem.
- The visible context is the Room's *receipt projection*, not yet a running multi-parent effectful Story Door kernel.
- Never use this experimental module as a general-purpose local HTTP write endpoint. Later UI integration should reuse the Room 005 exact-preview and explicit-confirmation boundary **only after** source-verification and authenticated actor gates are designed.

## Next bat

Feed one source-verified WORLDSEED-004 joint through the actual Room 005 loopback bridge, with a fixed version-pinned adapter, test two distinct authenticated decisions rather than labels, and adversarially kill/restart the bridge process during publication. Preserve the external witness records and refuse ambiguous retry.
