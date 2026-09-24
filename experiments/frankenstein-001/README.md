# FRANKENSTEIN-001 — Lemon → Address Loom → ROroomOM

**Experimental, opt-in, offline.** Open `index.html` directly; load a **real** Lemon Press Slice 003 receipt exported by the separate app. It is revalidated here by a bounded independent implementation of Slice 003's event reducer (see `core.js`). Choose a performed cup gesture; a quality mark or proposed-but-unperformed invention cannot become a source witness. Prepare/export a `frankenstein-door/v1-experimental` packet. Explicitly accept it into a new local guest preview (no inherited grants), then export a `roroomom-experience-score` v1 file for import into the separate ROroomOM 008 Experience Score UI. You can also import a saved door packet in a fresh session. Nothing writes to the source, to the parent Room repo, or to a connected service.

## Run with the five local source ZIPs

1. Open `lemon-press/slice-003/index.html` from the original Orphan Constellation bundle. Enter the room, mark shared qualities for Book and blue Cup, invent a relation and perform it. Export JSON under Receipt.
2. Open this `index.html`, import the exported receipt, select a witnessed cup event, prepare the packet and explicitly accept it. Download the ROroomOM score.
3. Open `room-006-008/repo-overlay/static-room.html` from the original bundle; in its Experience Score UI create a score for the selected block, choose **Import score JSON**, and select the Frankenstein score. The Room reassigns the score to its currently selected local object and creates new local card IDs; the original Lemon object ID is retained only as a source reference in a text card.

The branch does **not** ship the original Lemon app or the unpublished ROOM 008 overlay; those remain independently versioned in the local ZIP supplied in the preceding conversation. This is a real JSON boundary crossing, not a shared process or a combined canonical runtime. `address-loom-playsmash-001` remains its independent experiment; this adapter uses its consented door/receiver model, not its illustrative `door-packet/v0-play` format.

## Tests / verified boundaries

`node test.cjs` runs eight bounded kernel checks from the included fixture; `node test.cjs /path/to/room-006-008/repo-overlay` additionally calls the **actual** ROOM 008 `exValidate()` function against the exported score. To regenerate the fixture through the actual Lemon 003 `emit()` and `validate()` implementation, run `node create_fixture.cjs /path/to/lemon-press/slice-003/index.html`.

- Event replay checks object identity, event order, unique IDs, canonical relation witnesses, performed actions and explicit cup involvement. A user-supplied JSON and SHA-256 are **not** authenticated provenance.
- Door acceptance requires a separate explicit click; source permission or unexpected top-level packet fields are refused; accepting a duplicate event in the same receiver is refused; no source modification is made.
- A valid score is merely a **local interface proposal** to ROroomOM. The original ROOM 008 importer owns the final local object and independently checks the imported score's structure. The Source text card cannot grant privileges or mutate the ROOM capability layer.
- Scope: this is a local experimental bridge for **Slice 003** and the **blue cup** only; no live GitHub/Workbench/OS integration, no actor authentication, no trusted signatures, no MEMENTO admission, no arbitrary user-authored code execution.

## Provenance

Derived from user-supplied `lemon-press-living-artifact-003.zip`, `address-loom-playsmash-001.zip` and `ROroomOM-006-008-recomposed.zip`, recomposed into `orphan-constellation-20260924.zip`. Historical source editions and sibling ROOM 006 rejoining logic remain untouched. Review this experiment before promoting it; never conflate a local source claim with actual historical or remote attestation.