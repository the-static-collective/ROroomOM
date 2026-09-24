# ROroomOM 005 — The first executable capability crossing

**Status:** local experimental prototype. ROroomOM is the room inside the room: a creative field whose instruments can be composed around an encounter without absorbing project-owned authority.

Room 005 extends the Room 004 standalone field. Offline, it still supports authoring objects and relationships, scene/music/story/world desks, FogGlass, source excerpts and text imports, encounter re-entry, snapshots, and context capsules. The new **Instrument deck** appears in the creative Room and Source shelf.

## Try it now

Open `static-room.html` directly in a browser. Existing offline authoring works immediately; capability execution needs the optional local bridge below.

For the first *effectful* specimen (one Room-owned file), use Python 3.11+ on your Linux computer. From this folder:

```bash
python3 bridge_server.py
```

Open **http://127.0.0.1:13701/** in a browser on **the same computer**. In the Instrument deck, select **ROroomOM · materialize one Markdown artifact**, enter a title and a note, then choose **Prepare operation**. Carefully review the exact preview, tick the approval box, and choose **Execute this exact operation**. The created `.md` file is in `~/.local/state/roroomom/outbox/`; the independently inspectable receipt is in `~/.local/state/roroomom/receipts/`. The UI can retrieve a saved receipt using its 32-character ID. Preparation alone creates no outbox file. Browser drafts still reside separately in browser local storage, not in the outbox.

For the project-owned read-only instrument, start your **separately installed** [Static Workbench](https://github.com/the-static-collective/static-workbench) **v0.2.0** on its loopback port (default 13700), with a configured root containing local Git checkouts. Run the Room bridge above on that same computer; its default Workbench port is 13700. In Instrument deck, select **Workbench · bounded Creator Desk search**, discover a clean checkout, enter a 2–100-character search term, prepare, review the source locations, and explicitly execute. The search re-reads through Workbench's **own** `/api/creator/sources` GET operation and refuses changed HEAD or changed result bytes; its result and disposition receive a Room-local receipt. Select **Pin inspected result into creative field** to create a Room-local *research locator*, not an independently verified source file or canon. Use the separate **Live Workbench shelf** to prepare and inspect individual actual files before treating an excerpt as an observed witness.

If ports differ, use `python3 bridge_server.py --workbench-port 13700 --port 13701`. `--state-dir` changes only where Room-owned outbox and receipts live. The bridge binds to 127.0.0.1 only; a phone cannot reach a desktop's 127.0.0.1. On Android, the standalone HTML still provides the offline experience. Room 001–004 v1–v3 snapshots remain importable in the inherited local Room schema.

## Exact admission boundary

- Only two fixed, described operations are admitted: `static-workbench.creator.search-v1` (project-native read) and `roroomom.outbox.materialize-v1` (new Room-owned Markdown file).
- Every operation requires a separate prepare, a 120-second single-use ticket, exact SHA-256 input fingerprint confirmation, and an explicit second human action. Executions cannot be silently retried. The search compares its prepared and completed results.
- Workbench's existing source API version **0.2.0** is checked, but **this is not a full immutable Workbench binary or git-commit pin**. Workbench's reported HEAD is abbreviated, and source search reads a *local working tree*, not an immutable remote Git blob.
- The Room never forwards Workbench's session token or absolute root paths, accepts a user-supplied command/URL, calls Workbench write endpoints, or claims that a result is project-owned authorization. A read through Workbench may still leave Workbench's normal operational bookkeeping.
- Materialization writes only a **new, generated-filename** Markdown file under the Room-owned outbox. It does **not** edit an original source, publish anything, push GitHub commits, or execute a command from a source file. A per-operation JSON receipt is written separately and is recoverable by receipt ID. Disposition may be `completed`, `refused`, or `indeterminate`; the latter requires inspecting the outbox before retrying.
- The local bridge checks Host, Origin when present, Fetch Metadata, JSON body size, an explicit-action header, and allowlisted routes. These controls reduce browser-origin confusion, **not** malicious software already running as the same local user. Do not place untrusted secrets in the Room or expose the bridge to a network.
- Descriptors are only declarations of available operations; they cannot authorize a different project's mutation. The next project-owned effectful adapter must carry its *own* separate grant and destination-owned receipt.

## Test

```bash
python3 -m unittest discover -s . -p 'test_capability005.py' -v
```

The six contract tests exercise bounded effectful export, read-only Workbench search through a fake service matching its public GET shapes, changed evidence refusal, one-use approval, local receipt retrieval, HTTP Host/Origin/method guards, and Playwright/Chromium UI and mobile behavior. Browser tests use an in-memory page plus test-only HTTP transport because this runner disallows browser navigation to loopback. **They do not prove execution against your actual installed Workbench.**

## Package map

`static-room.html` is the complete standalone Room; `app.js`, `live-bridge.js`, and `room005.js` are inspectable component source, reassembled by `compose005.py`. `bridge_core.py` and `room004_server.py` preserve Room 004's read-only source bridge; `capability_core.py` and `bridge_server.py` admit the two new operations with independent local receipts. `source-manifest.json` holds prior historical project source coordinates. `test_capability005.py` is the executable contract/UX witness.

**Design law:** available ≠ authorized; prepared ≠ executed; accepted ≠ completed; a Room receipt ≠ a source project's receipt. A room can hold the instruments without claiming to be their owner.

## ROOM-006 — opt-in effectful rejoining experiment

The separate experimental [Rejoining Room browser setup](experiments/rejoining_room_006/BROWSER-SETUP.md) runs at `/rejoin` through `experiments/rejoining_room_006/bridge006.py`, only when independently pinned WORLDSEED-004 sources and the exact audited code package are supplied by the local operator. The existing Room-005 bridge and offline page are unchanged. Imported joint history never grants execution authority; the new effect is one Room-owned create-only artifact with an explicit preview, single-use local confirmation, and durable restart reconciliation. This remains a local demonstration, **not** authenticated two-person consent or project-native execution.
