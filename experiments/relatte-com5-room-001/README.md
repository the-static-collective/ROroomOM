# reLATTE × COM⁵ × ROroomOM Room 001

**Status:** local experimental receiver / Magic-Lego projection specimen.

> **The navigator finds the particular. The door chooses the projection. The Room composes the encounter.**

This experiment consumes the portable `relatte.enterable-particular/v0` projection introduced by reLATTE PR #14.

It turns one source particular into five possible **receiver-local ROroomOM encounters**:

```text
COMPOST → Residual Shelf
COMPOSE → Relation Board + addressed media instruments
COMPUTE → Receipt Console
COMMUTE → Road Map
COMMUNE → Participation Table
```

The source subject remains the same through all five doors. Every door entry creates a fresh ROroomOM-local encounter identity.

```text
FIVE DOORS != FIVE SUBJECTS
SOURCE SUBJECT != LOCAL ENCOUNTER
PROJECTION != AUTHORITY
```

## Try it

From this directory:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/`.

Choose **Load specimen** or import a JSON packet emitted by a compatible reLATTE checkout.

To generate one from reLATTE PR #14:

```bash
npm run --silent enter:song > /tmp/enterable-song.json
```

Then import that JSON into the Room page.

## What "Magic Lego" means here

ROroomOM does not receive a finished page.

It receives a bounded set of renderer proposals and assembles them into a local instrument deck.

A COMPOSE door carrying verified addressed payload refs may yield:

```text
Relation Board
Song / Audio Player
Text / Lyric Sheet
Video Window
Image Wall
Document Desk
Source Inspector
```

depending on the declared media refs.

The first implementation deliberately does **not fetch the addressed media bytes**. The blocks show the media address and type. Fetching/resolving content is a later adapter with its own transport and trust boundary.

```text
MEDIA REF != MEDIA CONTENT
PLAYER != OWNERSHIP
MEDIA TYPE != SEMANTIC MEANING
```

A text block is labeled Text / Lyric Sheet because the renderer can serve that shape; only the source role can justify calling a particular text payload "lyrics."

## Local encounter boundary

Opening the navigator is observational.

Entering a door requires explicit local acceptance.

The Room then creates:

- a fresh local encounter id;
- a local instrument deck;
- a local action trace;
- leave/return behavior;
- an optional ROroomOM-owned encounter receipt.

The receipt is not a reLATTE receipt and does not mutate the source.

```text
ROOM RECEIPT != reLATTE RECEIPT
LOCAL ENCOUNTER != SOURCE IDENTITY
INSTRUMENT USE != SOURCE MUTATION
```

## Test

```bash
node --test test.mjs
```

The contract tests cover five-door preservation, fresh receiver-local identity, distinct COMPOSE/COMMUTE rooms over the same source subject, explicit door acceptance, local instrument use, leave/return, receipt non-collapse, and authority-inflation refusal.

## Architectural composition

```text
              reLATTE navigator
                    │
                 particular
                    │
       ┌────┬────┬──┼──┬────┐
       ↓    ↓    ↓  ↓  ↓
      C₁   C₂   C₃ C₄ C₅
       └────┴────┴──┼──┴────┘
                    ↓
                 ROroomOM
                Magic Lego
                Workstation
                    ↓
             local encounter
                    ↓
               local receipt
                    ↓
                return road
```

**Design law:** the Room may inhabit a projection without claiming to become its source.


## Room 002 — real organ dock + return request

This branch adds the first actual Collective organ behind a Magic-Lego workstation block: **Static Workbench Source Inspector**.

Run Static Workbench v0.2 locally on its normal loopback port, then from this experiment directory:

```bash
python3 organ_bridge.py
```

Open `http://127.0.0.1:13702/`.

The page can now:

1. discover sanitized Workbench-local repository entries;
2. choose one repository and a bounded Markdown/text path;
3. **prepare** the exact source read;
4. explicitly **inspect** the same bytes only if HEAD/content remain unchanged;
5. show the inspected excerpt in the Room without claiming source authority.

The adapter reuses ROroomOM's existing `WorkbenchReadAdapter`; it does not add a second filesystem reader.

```text
SOURCE REF != LOCAL PATH
WORKBENCH READ != SOURCE AUTHORITY
INSPECTION != ADMISSION
```

The same Room can also export a bounded navigation request for one source-projected neighbor:

```text
Room encounter at A
→ ask reLATTE to re-center on B
→ request carries authority = none
→ reLATTE independently re-verifies A → B
→ fresh enterable B
```

The Room cannot manufacture a road by naming an arbitrary identifier.

```text
ROOM REQUEST != VERIFIED ROAD
REQUESTED SUBJECT != AUTHORIZED SUBJECT
reLATTE MUST REVERIFY NEIGHBOR
```

CI now exercises the complete loop using the actual producer and consumer branches:

```text
reLATTE signed history
→ real enterable packet
→ ROroomOM COMPOSE room
→ Room navigation request
→ reLATTE road re-verification
→ fresh destination packet
```

This is the first round trip where navigation and inhabitation remain owned by separate projects.


## Room 003 — verified audio becomes playable

The first media Lego is now backed by an independently governed organ: **Autodiscography Vault**.

The Room still receives only a reLATTE content address:

```text
audio-player
sourceRef = sha256:<digest>
```

Resolution proceeds through three separate boundaries:

```text
reLATTE address
→ ROroomOM media-resolution request
→ Autodiscography Vault resolver
→ verified receipt lookup
→ exact local byte re-verification
→ read-only loopback media URL
→ ROroomOM verifies returned digest/address
→ browser audio controls
```

The Room never opens a Vault path and the Vault never receives Room authority.

### Run locally

Start the Vault resolver from the `autodiscography-vault` checkout:

```bash
npm run resolver:serve -- \
  --vault-root /path/to/Autodiscography-Vault \
  --port 13703 \
  --room-origin http://127.0.0.1:13702
```

Then run this experiment's bridge:

```bash
python3 organ_bridge.py --port 13702 --workbench-port 13700 --vault-port 13703
```

Open `http://127.0.0.1:13702/`.

Enter a COMPOSE room containing an `audio-player` whose `sourceRef` is the SHA-256 address of a verified Vault audio object. Press **Resolve verified audio**. Only after the Vault returns the same address/digest and a compatible read-only playback URL does the card become a browser `<audio controls>` player.

The bundled demo packet uses synthetic placeholder hashes, so its player will correctly refuse unless a matching local Vault object exists. Use a real reLATTE packet whose audio ref matches admitted Vault bytes for live playback.

### Media laws

```text
MEDIA REQUEST != RESOLUTION
RESOLVER MAY NOT SUBSTITUTE ADDRESS
PLAYER != OWNER
PLAYBACK != SOURCE MUTATION
VAULT RESOLUTION != ROOM ADMISSION
```

### CI proof

Room 003 CI now:

1. verifies reLATTE and the existing Room round trip;
2. checks out the Vault resolver branch;
3. admits a synthetic RIFF/WAVE object into a temporary Vault;
4. starts the real loopback Vault resolver;
5. requests a browser-origin byte range and checks `206`, CORS, RIFF and WAVE bytes;
6. resolves the exact hash through the ROroomOM Vault organ;
7. upgrades the matching audio Lego through the Room kernel;
8. confirms source mutation and shared-world mutation remain false.

That is the first real media-byte crossing in the COM⁵ workstation.


## Room 004 — Video Window enters the future

The second playable media Lego is now backed by **Haunted Blender**.

The Room still receives only a reLATTE address:

```text
video-player
sourceRef = sha256:<digest>
```

But unlike audio resolution, Video Window adds a selection boundary before playback:

```text
candidate clip exists
!=
filmmaker accepted it
```

Haunted Blender resolves only when the digest belongs to a currently valid:

```text
filmmaker_accepted_private_preview
```

with unchanged:

- acceptance witness;
- generation request lineage;
- Scene Artifact relationship;
- admission receipt;
- MP4 bytes;
- playable video stream.

ROroomOM independently checks that the returned organ, status, digest, MIME type and loopback playback URL still match the exact `video-player` Lego request.

Only then does the block become:

```text
<video controls>
```

while retaining:

```text
distributionAuthorized = false
```

### Local stack

Run Haunted Blender's accepted-video resolver:

```bash
PYTHONPATH=. python -m haunted_blender.accepted_video_server \
  ~/HauntedBlender \
  --port 13704 \
  --room-origin http://127.0.0.1:13702
```

Run the Room organ bridge:

```bash
python3 organ_bridge.py \
  --port 13702 \
  --workbench-port 13700 \
  --vault-port 13703 \
  --blender-port 13704
```

### Video laws

```text
ADDRESS != ACCEPTANCE
CANDIDATE != FILMMAKER ACCEPTED TAKE
VIDEO WINDOW != RELEASE
PLAYBACK != BLENDER EDIT
BLENDER ACCEPTANCE != ROOM AUTHORITY
```

### CI proof

Room 004 keeps the complete reLATTE round trip and verified Vault audio proof, then additionally:

1. checks out the Haunted Blender Video Window branch;
2. builds a real synthetic Scene Artifact;
3. creates a frozen take request;
4. admits a synthetic MP4 candidate;
5. explicitly filmmaker-accepts the private take;
6. starts Blender's real read-only resolver;
7. range-requests the MP4 from the Room origin and checks HTTP 206 + `ftyp`;
8. resolves the exact digest through the ROroomOM Blender organ;
9. upgrades the matching `video-player` Lego;
10. preserves source mutation = false and distribution authorization = false.

That is the first moving-image organ in the walkable COM⁵ workstation.


## Room 005 — the blocks compose together

Room 005 adds the first **Room Score**: a receiver-local temporal composition over already-resolved Magic Lego.

```text
verified audio
+
filmmaker-accepted video
+
exact locally matched text
        ↓
explicit Room Score
        ↓
one playback clock
+
media offsets
+
lyric line cues
        ↓
synchronized local encounter
```

The score is not a new source object and does not collapse the participating particulars.

```text
ROOM SCORE != SOURCE
SYNC != MERGER
CUE != CLAIM
LOCAL ARRANGEMENT != SOURCE MUTATION
COMPOSITION != OWNERSHIP
ONE CLOCK != ONE IDENTITY
```

The Text Sheet is deliberately receiver-local. A selected UTF-8 text/Markdown file is SHA-256 hashed in the local runtime and accepted only when its exact digest matches the reLATTE media address. The exported encounter receipt records the digest, byte count, line count, cue ranges and media bindings — not the lyric plaintext.

The browser workstation now exposes an editable Room Score surface with **Draft local score**, **Compile score**, **Conduct**, and **Stop**. Draft timing is only a local suggestion. Compilation is explicit and still carries `authority: none`.

See [ROOM_SCORE_005.md](ROOM_SCORE_005.md) for the score contract and laws.

### CI proof

Room 005 retains the full earlier stack and then performs one more composition:

```text
real Vault resolver descriptor
+
real Haunted Blender accepted-video descriptor
+
exact local lyric bytes
        ↓
Room Score compilation
        ↓
clock frame at 1s
clock frame at 9s
        ↓
video seek offset verified
lyric cue transition verified
        ↓
receipt proves hashes + cues
receipt contains no lyric plaintext
```

This is the first point where the Magic Lego blocks do not merely coexist on a shelf: **they can perform together without becoming one thing.**


## Room 006 — the block remembers being played

Room 006 composes the executable Room Score with the temporal law from Haunted Toaster's Future Rearview Memory Prophecy.

The added gate is:

```text
PLAYBACK != PREFERENCE
```

A performance enters Play Memory only after:

```text
compiled Room Score
→ actual CONDUCT event
→ local encounter receipt
→ explicit human keep / weird / compost verdict
→ explicit re-open choice
→ deterministic memory capsule
```

That memory can be projected both onto the source particular and onto each exact addressed Lego that participated in the score.

The browser workstation now has a **PLAY MEMORY** shelf. Verified memory capsules persist in browser-local storage and survive re-entry. The current particular shows its verified prior performance count and invitation kinds; each song/video/text Lego shows its own addressed play memory.

Before any memory contributes to future pressure, ROroomOM recomputes the capsule SHA-256. Locally altered capsules are excluded.

The current prophecy grammar is invitation-only:

```text
KEEP    → REPRISE
WEIRD   → MUTATE_NEARBY
COMPOST → COMPOST_RESIDUE
explicit re-open → REOPEN
3+ witnessed performances → CONTRAST
```

None of those actions execute automatically.

```text
RECEIPT != LEARNING
LEARNING != PROPHECY
PROPHECY != AUTHORITY
HUMAN VERDICT != SOURCE AUTHORITY
MEMORY != SOURCE MUTATION
REOPEN != REPLAY
```

See [PLAY_MEMORY_006.md](PLAY_MEMORY_006.md).

### CI proof

Room 006 retains the entire earlier stack and then uses the same real Vault audio descriptor, real filmmaker-accepted Blender video descriptor, and exact lyric bytes to create three actual conducted local scores with explicit human verdicts.

The final contract proves:

- the particular remembers three attributable performances;
- the exact song Lego independently projects the same three participations;
- KEEP / WEIRD / COMPOST remain human declarations, not inferred preferences;
- invitations remain `invitation-only`;
- a locally forged memory capsule is excluded;
- memory carries hashes and addressed participation, not lyric plaintext.

This is the first executable version of:

> **The block remembers being played.**


## Room 007 — human ↔ AI crossing rail

Room 007 makes the AI a visible participant rather than an invisible system-wide authority.

The first crossing is intentionally narrow:

```text
compiled Room Score
→ verified Play Memory
→ AI proposes ONE media timing change
→ visible basis / rationale / diff / invariants
→ HUMAN: ACCEPT | HOLD | REFUSE
→ attributable crossing receipt
```

Nothing changes when the proposal is created.

The proposal must visibly answer:

```text
WHO proposed this?
WHAT did it use?
WHY this?
WHAT will change?
WHAT will not change?
WHO decides?
```

The first allowed patch is only:

```text
SET_MEDIA_OFFSET_MS
```

for one already-resolved media track. Source refs, resolved hashes, lyric addresses/cues, reLATTE history, and source bytes are declared invariants.

Every proposal carries a deterministic proposal hash plus the current Room Score SHA-256 as a precondition. Edited proposals and stale proposals are refused.

The workstation now renders a **HUMAN ↔ AI CROSSING RAIL** with a staged proposal card and explicit:

```text
ACCEPT
HOLD
REFUSE
```

Each decision produces a local crossing receipt. HOLD and REFUSE are attributable non-actions; ACCEPT recompiles only the local Room Score arrangement.

```text
AI PARTICIPANT != SYSTEM
PROMPT != AUTHORITY
INTERPRETATION != INTENT
PROPOSAL != CONSENT
MEMORY INFLUENCE != PERMISSION
ACCEPTANCE REQUIRES HUMAN CROSSING

AI PROPOSAL != HUMAN DECISION
HOLD != ACCEPT
REFUSE != ERASURE
ACCEPT != SOURCE AUTHORITY
LOCAL SCORE CHANGE != SOURCE MUTATION
```

See [HUMAN_AI_CROSSING_007.md](HUMAN_AI_CROSSING_007.md).

### CI proof

Room 007 keeps the entire reLATTE → organs → Room Score → Play Memory stack, then:

1. conducts a real score backed by the real Vault/Blender test descriptors and exact lyric bytes;
2. records an explicit WEIRD + re-open memory;
3. lets an identified AI participant see that verified memory invitation;
4. proposes only a bounded video timing shift;
5. proves the Room Score remains unchanged before a human decision;
6. HOLDs it and proves no score mutation;
7. ACCEPTs the held proposal and proves only the intended local offset changes;
8. proves all source refs and resolved SHA-256 identities remain identical;
9. stages another proposal and REFUSEs it without change.

This is the first executable human/AI cross-crossing in the workstation.
