# ROroomOM-006 — Browser setup and trust boundaries

The new optional /rejoin page is served by bridge006.py. The existing Room-005 bridge, static-room.html and offline authoring are unchanged. This experiment is local-only and not a live two-person authorization service.

## 1. Prepare the source

Use a trusted extraction of the standalone WORLDSEED-004 BAT package on the same computer as ROroomOM. The package must contain static_workbench/experimental/worldseed_003.py, worldseed_rejoin_004.py, and their four listed dependencies. The Room-006 bridge checks their exact SHA-256 source bytes against a frozen code pin before admission; a different version intentionally refuses until reviewed.

Generate a demo root, A, B, and joint with the package's included script:

~~~bash
python3 demo_worldseed_rejoin.py --workdir /absolute/path/to/NEW-worldseed-004-home
~~~

The destination must not exist before running this command. Preserve the output demo-receipt-004.json **outside** the imported home in a trusted operator-owned location. Its root_seal, branch_a_seal, branch_b_seal, join_seal and root_state_id are inputs to the receiving bridge's trust decision. For real data, obtain the seals and root identity from an independent trusted channel, not by accepting claims in the untrusted imported files. Hashes give byte integrity, not publisher authentication or guaranteed recency.

## 2. Write the operator-owned pin file

Place the following JSON outside both the imported WORLDSEED home and the Room state directory:

~~~json
{
  "home": "/absolute/path/to/NEW-worldseed-004-home",
  "root_seal": "independently recorded 64-hex root seal",
  "a_seal": "independently recorded 64-hex branch-A seal",
  "b_seal": "independently recorded 64-hex branch-B seal",
  "joint_seal": "independently recorded 64-hex joint seal",
  "root_state_id": "independently recorded root state ID"
}
~~~

Replace the illustrative values with the exact corresponding data. The browser cannot provide these values or change the source paths. The bridge rechecks the full pinned source at preparation and again before an attempted effect.

## 3. Start the optional Room bridge

From your ROroomOM checkout:

~~~bash
python3 experiments/rejoining_room_006/bridge006.py \
  --worldseed-lib /absolute/path/to/extracted-WORLDSEED-004-package \
  --pins-file /absolute/path/to/operator-owned-pins.json \
  --state-dir ~/.local/state/roroomom \
  --port 13701 --workbench-port 13700
~~~

Open http://127.0.0.1:13701/rejoin on the **same machine**, or follow the Rejoining Room link on the main Room page.

The Room-005 capability deck remains present. The new page shows the verified joint, explicit two-parent identities, tension and open questions. Enter exact Markdown, prepare the candidate, review the complete preview, separately confirm, then execute the one local Room-owned create-only file effect.

The imported joint is historical evidence, not execution permission. The explicit operator action is not an authenticated human signature, and the historic WORLDSEED witness labels are not two authenticated consents to this new effect.

## 4. Inspect after interruption

A receipt gives the crossing address (roomx_...). Paste that address into the recovery panel. The journal and the create-only outbox are preserved beneath ~/.local/state/roroomom/rejoining_room_006/.

After a crash that left only a durable intent, inspection displays the exact pending effect bytes and their SHA-256 digest. A fresh, separate confirmation can complete **that existing intent only**. After a crash that created the artifact but not the receipt, inspection verifies the existing bytes and completes the receipt without recreating the file. Conflicting or missing completed artifacts refuse.

The HTTP boundary reuses Room-005 same-origin loopback controls and a bounded explicit-action header; these do not authenticate a malicious program running as the same user. No public network listener, arbitrary shell command, project-native effect, unbounded filesystem path, or automatic retry is exposed.

## BATs

~~~bash
python3 -m unittest discover -s experiments/rejoining_room_006 -p 'test*.py' -v
~~~

The engine BATs inject three real process deaths. The HTTP BATs use a synthetic pinned-joint fixture and exercise actual loopback endpoints, one-use approval, source drift, forged client-supplied ancestry, read-only projection, and recovery consent. CI runs these exact repository files. The separate WORLDSEED-004 package is needed for the complete local-source import path; CI alone does not prove publisher identity or multi-user authentication.

Next frontier: independently authenticated decisions bound to the exact crossing digest, then real bridge-level process-death testing against a production-capable project-owned effect adapter. Those are **not** granted by this experimental browser.
